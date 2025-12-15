import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Order, Product, Customer, CalibrationStatus, Technician } from '../types';
import { CONFIG } from './config';

class SupabaseService {
  private supabase: SupabaseClient | null = null;
  private isConnected: boolean = false;

  // In-Memory Mock Store
  private mockStore: Record<string, any[]> = {
    [CONFIG.TABLES.ORDERS]: [],
    [CONFIG.TABLES.PRODUCTS]: [
      { id: 'p1', name: '數位卡尺', specification: '0-150mm', category: '長度', standard_price: 500, last_updated: new Date().toISOString() },
      { id: 'p2', name: '壓力錶', specification: '0-10kg/cm2', category: '壓力', standard_price: 1200, last_updated: new Date().toISOString() },
      { id: 'p3', name: '三用電表', specification: 'Fluke 179', category: '電量', standard_price: 2500, last_updated: new Date().toISOString() }
    ],
    [CONFIG.TABLES.CUSTOMERS]: [
      { id: 'c1', name: '台積電', contact_person: '張經理', phone: '0912345678' },
      { id: 'c2', name: '聯發科', contact_person: '王工程師', phone: '0987654321' }
    ],
    [CONFIG.TABLES.TECHNICIANS]: [
      { id: 't1', name: '陳小明' },
      { id: 't2', name: '林大華' }
    ],
    [CONFIG.TABLES.ADMIN_SETTINGS]: [],
    [CONFIG.TABLES.USER_SETTINGS]: []
  };

  constructor() {
    this.init();
  }

  private init() {
    // Defensive check: Ensure URL looks valid before attempting createClient
    if (CONFIG.SUPABASE.URL && CONFIG.SUPABASE.KEY && CONFIG.SUPABASE.URL.startsWith('http')) {
      try {
        this.supabase = createClient(CONFIG.SUPABASE.URL, CONFIG.SUPABASE.KEY);
        this.isConnected = true;
        console.log('✅ Supabase Client Initialized');
      } catch (e) {
        console.error('❌ Supabase Initialization Failed:', e);
        this.isConnected = false;
      }
    } else {
      console.warn('⚠️ Missing or Invalid Supabase Config, falling back to Mock mode (Memory Only)');
      this.isConnected = false;
    }
  }

  public getEnvironmentType(): 'supabase' | 'mock' {
    return this.isConnected ? 'supabase' : 'mock';
  }

  private switchToMock(error?: any) {
    console.warn('⚠️ Operation failed, switching to Offline Mock Mode to preserve data consistency.', error);
    // CRITICAL FIX:
    // If any write fails (e.g. UUID format, Constraints, Network), we MUST disconnect.
    // This ensures the UI immediately starts reading from the mockStore (where we successfully cached the write),
    // preventing the "Order Disappears" bug.
    this.isConnected = false;
  }

  // Helper to check if string is UUID
  private isValidUUID(uuid: string) {
    const regex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return regex.test(uuid);
  }

  // --- Core: Recursive Fetch for > 1000 rows ---
  private async fetchAllData(tableName: string, orderByCol: string = 'id', ascending: boolean = true): Promise<any[]> {
    if (!this.isConnected || !this.supabase) {
      const data = this.mockStore[tableName] || [];
      return [...data].sort((a, b) => {
        if (a[orderByCol] < b[orderByCol]) return ascending ? -1 : 1;
        if (a[orderByCol] > b[orderByCol]) return ascending ? 1 : -1;
        return 0;
      });
    }

    let allData: any[] = [];
    let page = 0;
    const size = CONFIG.CONSTANTS.BATCH_SIZE;

    try {
      while (true) {
        const from = page * size;
        const to = from + size - 1;

        const { data, error } = await this.supabase
          .from(tableName)
          .select('*', { count: 'exact' })
          .range(from, to)
          .order(orderByCol, { ascending });

        if (error) {
          // If table missing, fallback to mock without disconnecting (soft fail)
          if (error.code === '42P01') {
            console.warn(`Table ${tableName} not found in Supabase. Using mock.`);
            const mockData = this.mockStore[tableName] || [];
            return mockData;
          }
          throw error;
        }

        if (data) {
          allData = [...allData, ...data];
        }

        if (!data || data.length < size) break;
        page++;
      }
    } catch (e) {
      console.error(`Fetch Error (${tableName}), switching to mock:`, e);
      this.switchToMock(e);
      // Fallback to mock data immediately
      return this.mockStore[tableName] || [];
    }

    return allData;
  }

  // --- Auth Service ---

  async verifyAdminPassword(password: string): Promise<boolean> {
    const inputPwd = password.trim();

    if (!this.isConnected || !this.supabase) return inputPwd === '0000';

    try {
      const { data, error } = await this.supabase
        .from(CONFIG.TABLES.ADMIN_SETTINGS)
        .select('value')
        .eq('key', CONFIG.CONSTANTS.ADMIN_PWD_KEY)
        .single();

      if (error) {
        if (error.code === 'PGRST116' || error.code === '42P01') return inputPwd === '0000';
        return false;
      }

      if (!data) return false;
      return data.value.trim() === inputPwd;
    } catch (e) {
      return inputPwd === '0000';
    }
  }

  async verifyEngineerPassword(name: string, password: string): Promise<boolean> {
    if (!this.isConnected || !this.supabase) return true;

    try {
      const key = `${CONFIG.CONSTANTS.USER_PWD_PREFIX}${name}`;
      const { data, error } = await this.supabase
        .from(CONFIG.TABLES.USER_SETTINGS)
        .select('value')
        .eq('key', key)
        .single();

      if (error || !data) return false;
      return data.value.trim() === password.trim();
    } catch (e) {
      return false;
    }
  }

  async setEngineerPassword(name: string, password: string): Promise<void> {
    if (this.isConnected && this.supabase) {
      try {
        const key = `${CONFIG.CONSTANTS.USER_PWD_PREFIX}${name}`;
        await this.supabase
          .from(CONFIG.TABLES.USER_SETTINGS)
          .upsert({ key, value: password.trim() });
      } catch (e) {
        this.switchToMock(e);
      }
    }
  }

  async changeAdminPassword(oldPwd: string, newPwd: string): Promise<boolean> {
    const isValid = await this.verifyAdminPassword(oldPwd);
    if (!isValid) return false;

    if (this.isConnected && this.supabase) {
      try {
        await this.supabase
          .from(CONFIG.TABLES.ADMIN_SETTINGS)
          .upsert({ key: CONFIG.CONSTANTS.ADMIN_PWD_KEY, value: newPwd.trim() });
      } catch (e) {
        this.switchToMock(e);
      }
    }
    return true;
  }

  // --- Mappers ---
  private mapOrderFromDB(data: any): Order {
    return {
      id: data.id,
      orderNumber: data.order_number,
      equipmentNumber: data.equipment_number,
      equipmentName: data.equipment_name,
      customerName: data.customer_name,
      productId: data.product_id,
      productName: data.product_name,
      productSpec: data.product_spec,
      category: data.category,
      calibrationType: data.calibration_type,
      quantity: data.quantity,
      unitPrice: data.unit_price,
      discountRate: data.discount_rate,
      totalAmount: data.total_amount !== undefined ? data.total_amount : Math.round(data.unit_price * data.quantity * (data.discount_rate / 100)),
      status: data.status,
      createDate: data.create_date,
      targetDate: data.target_date,
      technicians: data.technicians || [],
      notes: data.notes,
      isArchived: data.is_archived,
      resurrectReason: data.resurrect_reason
    };
  }

  private mapProductFromDB(data: any): Product {
    return {
      id: data.id,
      name: data.name,
      specification: data.specification,
      category: data.category,
      standardPrice: data.standard_price,
      lastUpdated: data.last_updated
    };
  }

  // --- Data Methods ---

  async getInventory(): Promise<Product[]> {
    const data = await this.fetchAllData(CONFIG.TABLES.PRODUCTS, 'name', true);
    return data.map(this.mapProductFromDB);
  }

  async addProduct(product: Omit<Product, 'id'>): Promise<Product> {
    const newItem = {
      id: 'prod-' + Date.now(),
      name: product.name,
      specification: product.specification,
      category: product.category,
      standard_price: product.standardPrice,
      last_updated: new Date().toISOString()
    };

    // ALWAYS update mock store for consistency
    this.mockStore[CONFIG.TABLES.PRODUCTS].push(newItem);

    if (this.isConnected && this.supabase) {
      try {
        const { id, ...supabasePayload } = newItem;
        const { data, error } = await this.supabase
          .from(CONFIG.TABLES.PRODUCTS)
          .insert(supabasePayload)
          .select()
          .single();
        if (error) throw error;
        // Update the mock item with the real ID from DB
        const index = this.mockStore[CONFIG.TABLES.PRODUCTS].findIndex(p => p.id === newItem.id);
        if (index !== -1 && data) {
          this.mockStore[CONFIG.TABLES.PRODUCTS][index] = { ...newItem, id: data.id };
        }
        return this.mapProductFromDB(data);
      } catch (e) {
        this.switchToMock(e);
      }
    }

    return this.mapProductFromDB(newItem);
  }

  async getCustomers(): Promise<Customer[]> {
    const data = await this.fetchAllData(CONFIG.TABLES.CUSTOMERS, 'name', true);
    return data as Customer[];
  }

  async addCustomer(name: string): Promise<Customer> {
    const newItem = { id: 'cust-' + Date.now(), name };

    // ALWAYS update mock store
    this.mockStore[CONFIG.TABLES.CUSTOMERS].push(newItem);

    if (this.isConnected && this.supabase) {
      try {
        const { id, ...supabasePayload } = newItem;
        const { data, error } = await this.supabase.from(CONFIG.TABLES.CUSTOMERS).insert(supabasePayload).select().single();
        if (error) throw error;
        // Update the mock item with the real ID from DB
        const index = this.mockStore[CONFIG.TABLES.CUSTOMERS].findIndex(c => c.id === newItem.id);
        if (index !== -1 && data) {
          this.mockStore[CONFIG.TABLES.CUSTOMERS][index] = { ...newItem, id: data.id };
        }
        return data as Customer;
      } catch (e) {
        this.switchToMock(e);
      }
    }

    return newItem as Customer;
  }

  async getTechnicians(): Promise<Technician[]> {
    const data = await this.fetchAllData(CONFIG.TABLES.TECHNICIANS, 'name', true);
    return data as Technician[];
  }

  async addTechnician(name: string): Promise<Technician> {
    const newItem = { id: 'tech-' + Date.now(), name };
    this.mockStore[CONFIG.TABLES.TECHNICIANS].push(newItem);

    if (this.isConnected && this.supabase) {
      try {
        const { id, ...supabasePayload } = newItem;
        const { data, error } = await this.supabase.from(CONFIG.TABLES.TECHNICIANS).insert(supabasePayload).select().single();
        if (error) throw error;
        return data as Technician;
      } catch (e) {
        this.switchToMock(e);
      }
    }

    return newItem as Technician;
  }

  async removeTechnician(id: string): Promise<void> {
    this.mockStore[CONFIG.TABLES.TECHNICIANS] = this.mockStore[CONFIG.TABLES.TECHNICIANS].filter(t => t.id !== id);

    if (this.isConnected && this.supabase) {
      try {
        const { error } = await this.supabase.from(CONFIG.TABLES.TECHNICIANS).delete().eq('id', id);
        if (error) throw error;
      } catch (e) {
        this.switchToMock(e);
      }
    }
  }

  async getOrders(): Promise<Order[]> {
    const data = await this.fetchAllData(CONFIG.TABLES.ORDERS, 'create_date', false);
    return data.map(this.mapOrderFromDB);
  }

  async checkOrderExists(orderNumber: string): Promise<boolean> {
    if (this.isConnected && this.supabase) {
      try {
        const { count, error } = await this.supabase
          .from(CONFIG.TABLES.ORDERS)
          .select('*', { count: 'exact', head: true })
          .eq('order_number', orderNumber);

        if (error) throw error;
        return (count || 0) > 0;
      } catch (e) {
        console.error('Check order failed, using mock check', e);
        // Don't disconnect just for a check failure, check local
      }
    }
    return this.mockStore[CONFIG.TABLES.ORDERS].some(o => o.order_number === orderNumber);
  }

  async createOrders(ordersData: any[], manualOrderNumber: string): Promise<void> {
    // 1. Prepare Data for Local Store (Optimistic)
    const dbPayloads = ordersData.map((o, index) => ({
      id: `ord-${Date.now()}-${index}`,
      order_number: manualOrderNumber,
      equipment_number: o.equipmentNumber,
      equipment_name: o.equipmentName,
      customer_name: o.customerName,
      product_id: o.productId,
      product_name: o.productName,
      product_spec: o.productSpec,
      category: o.category,
      calibration_type: o.calibrationType,
      quantity: o.quantity,
      unit_price: o.unitPrice,
      discount_rate: o.discountRate,
      total_amount: Math.round(o.unitPrice * o.quantity * (o.discountRate / 100)),
      status: o.status,
      create_date: new Date().toISOString(),
      target_date: o.targetDate,
      technicians: o.technicians,
      notes: o.notes,
      is_archived: false
    }));

    // 2. Always Push to Mock Store First (Ensures UI updates even if DB fails)
    this.mockStore[CONFIG.TABLES.ORDERS].push(...dbPayloads);
    console.log('✅ Mock Orders Created (Optimistic UI):', dbPayloads.length);

    // 3. Try Supabase Insert
    if (this.isConnected && this.supabase) {
      try {
        // Sanitize payload for Supabase
        const supabasePayloads = dbPayloads.map(({ id, ...rest }) => {
          // Fix for UUID: If product_id is a temp ID (e.g. "prod-123" or "TEMP-123"), 
          // do NOT send it to a Supabase UUID column. Send null instead.
          let cleanPid = rest.product_id;
          if (cleanPid && !this.isValidUUID(cleanPid)) {
            cleanPid = null; // Or undefined
          }

          return {
            ...rest,
            product_id: cleanPid
            // Note: 'technicians' is string[]. Supabase JS client handles this for text[] or jsonb columns automatically.
            // If the column doesn't exist, this will throw, but we catch it below.
          };
        });

        const { error } = await this.supabase.from(CONFIG.TABLES.ORDERS).insert(supabasePayloads);
        if (error) throw error;
        console.log('✅ Supabase Orders Synced');
      } catch (e) {
        console.error('⚠️ Create orders failed in Supabase, switching to OFFLINE mode.', e);
        // CRITICAL: Force disconnect to ensure the user sees the orders we just pushed to mockStore
        this.switchToMock(e);
      }
    }
  }

  async updateOrderStatusByNo(orderNumber: string, newStatus: CalibrationStatus): Promise<void> {
    // Optimistic Update
    const orders = this.mockStore[CONFIG.TABLES.ORDERS];
    orders.forEach(o => {
      if (o.order_number === orderNumber) {
        o.status = newStatus;
        if (newStatus === CalibrationStatus.COMPLETED) o.is_archived = true;
      }
    });

    if (this.isConnected && this.supabase) {
      try {
        const updates: any = { status: newStatus };
        if (newStatus === CalibrationStatus.COMPLETED) {
          updates.is_archived = true;
        }
        const { error } = await this.supabase.from(CONFIG.TABLES.ORDERS).update(updates).eq('order_number', orderNumber);
        if (error) throw error;
      } catch (e) {
        this.switchToMock(e);
      }
    }
  }

  async updateOrderNotesByNo(orderNumber: string, notes: string): Promise<void> {
    this.mockStore[CONFIG.TABLES.ORDERS].filter(o => o.order_number === orderNumber).forEach(o => o.notes = notes);

    if (this.isConnected && this.supabase) {
      try {
        const { error } = await this.supabase.from(CONFIG.TABLES.ORDERS).update({ notes }).eq('order_number', orderNumber);
        if (error) throw error;
      } catch (e) {
        this.switchToMock(e);
      }
    }
  }

  async updateOrderTargetDateByNo(orderNumber: string, newDate: string): Promise<void> {
    this.mockStore[CONFIG.TABLES.ORDERS].filter(o => o.order_number === orderNumber).forEach(o => o.target_date = new Date(newDate).toISOString());

    if (this.isConnected && this.supabase) {
      try {
        const { error } = await this.supabase.from(CONFIG.TABLES.ORDERS).update({ target_date: new Date(newDate).toISOString() }).eq('order_number', orderNumber);
        if (error) throw error;
      } catch (e) {
        this.switchToMock(e);
      }
    }
  }

  async updateOrderItem(id: string, updates: { quantity: number; unitPrice: number; totalAmount: number }): Promise<void> {
    const item = this.mockStore[CONFIG.TABLES.ORDERS].find(o => o.id === id);
    if (item) {
      item.quantity = updates.quantity;
      item.unit_price = updates.unitPrice;
      item.total_amount = updates.totalAmount;
    }

    if (this.isConnected && this.supabase) {
      try {
        const { error } = await this.supabase.from(CONFIG.TABLES.ORDERS).update({
          quantity: updates.quantity,
          unit_price: updates.unitPrice,
          total_amount: updates.totalAmount
        }).eq('id', id);
        if (error) throw error;
      } catch (e) {
        this.switchToMock(e);
      }
    }
  }

  async restoreOrderByNo(orderNumber: string, reason: string): Promise<void> {
    this.mockStore[CONFIG.TABLES.ORDERS].filter(o => o.order_number === orderNumber).forEach(o => {
      o.is_archived = false;
      o.status = CalibrationStatus.PENDING;
      o.resurrect_reason = reason;
    });

    if (this.isConnected && this.supabase) {
      try {
        const { error } = await this.supabase.from(CONFIG.TABLES.ORDERS).update({
          is_archived: false,
          status: CalibrationStatus.PENDING,
          resurrect_reason: reason
        }).eq('order_number', orderNumber);
        if (error) throw error;
      } catch (e) {
        this.switchToMock(e);
      }
    }
  }

  async deleteOrderByNo(orderNumber: string): Promise<void> {
    this.mockStore[CONFIG.TABLES.ORDERS] = this.mockStore[CONFIG.TABLES.ORDERS].filter(o => o.order_number !== orderNumber);

    if (this.isConnected && this.supabase) {
      try {
        const { error } = await this.supabase.from(CONFIG.TABLES.ORDERS).delete().eq('order_number', orderNumber);
        if (error) throw error;
      } catch (e) {
        this.switchToMock(e);
      }
    }
  }

  async checkAdminPassword(input: string): Promise<boolean> {
    return this.verifyAdminPassword(input);
  }
}

export const mockGasService = new SupabaseService();