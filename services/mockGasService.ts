
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Order, Product, Customer, CalibrationStatus, Technician } from '../types';
import { CONFIG } from '../config';

class SupabaseService {
  private supabase: SupabaseClient | null = null;
  private isConnected: boolean = false;

  constructor() {
    this.init();
  }

  private init() {
    // Defensive check: Ensure URL looks valid before attempting createClient
    // This prevents the "URL is required" or "Invalid URL" error from crashing the entire app on load
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
      console.warn('⚠️ Missing or Invalid Supabase Config, falling back to Mock mode (limited functionality)');
      this.isConnected = false;
    }
  }

  public getEnvironmentType(): 'supabase' | 'mock' {
    return this.isConnected ? 'supabase' : 'mock';
  }

  // --- Core: Recursive Fetch for > 1000 rows ---
  private async fetchAllData(tableName: string, orderByCol: string = 'id', ascending: boolean = true): Promise<any[]> {
    if (!this.isConnected || !this.supabase) return [];

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
                console.error(`Error fetching ${tableName}:`, error);
                break;
            }

            if (data) {
                allData = [...allData, ...data];
            }

            // Break if we've fetched all records or if returned data is smaller than page size
            if (!data || data.length < size) break;
            page++;
        }
    } catch (e) {
        console.error("Critical Fetch Error:", e);
        return [];
    }

    return allData;
  }

  // --- Auth Service ---

  async verifyAdminPassword(password: string): Promise<boolean> {
      if (!this.isConnected || !this.supabase) return password === '0000'; // Mock fallback

      try {
        const { data, error } = await this.supabase
            .from(CONFIG.TABLES.ADMIN_SETTINGS)
            .select('value')
            .eq('key', CONFIG.CONSTANTS.ADMIN_PWD_KEY)
            .single();

        if (error || !data) return false;
        return data.value === password;
      } catch (e) {
        console.error(e);
        return false;
      }
  }

  async verifyEngineerPassword(name: string, password: string): Promise<boolean> {
      if (!this.isConnected || !this.supabase) return true; // Mock allow if no DB

      try {
        const key = `${CONFIG.CONSTANTS.USER_PWD_PREFIX}${name}`;
        const { data, error } = await this.supabase
            .from(CONFIG.TABLES.USER_SETTINGS)
            .select('value')
            .eq('key', key)
            .single();

        // If no password set for user, we deny access to enforce security
        if (error || !data) return false; 
        return data.value === password;
      } catch (e) {
        console.error(e);
        return false;
      }
  }

  async setEngineerPassword(name: string, password: string): Promise<void> {
      if (!this.isConnected || !this.supabase) return;
      const key = `${CONFIG.CONSTANTS.USER_PWD_PREFIX}${name}`;
      await this.supabase
        .from(CONFIG.TABLES.USER_SETTINGS)
        .upsert({ key, value: password });
  }

  async changeAdminPassword(oldPwd: string, newPwd: string): Promise<boolean> {
      const isValid = await this.verifyAdminPassword(oldPwd);
      if (!isValid) return false;

      if (this.isConnected && this.supabase) {
          await this.supabase
            .from(CONFIG.TABLES.ADMIN_SETTINGS)
            .upsert({ key: CONFIG.CONSTANTS.ADMIN_PWD_KEY, value: newPwd });
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
      totalAmount: Math.round(data.unit_price * data.quantity * (data.discount_rate / 100)),
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
    if (!this.isConnected || !this.supabase) throw new Error("No DB");
    
    const { data, error } = await this.supabase
        .from(CONFIG.TABLES.PRODUCTS)
        .insert({
            name: product.name,
            specification: product.specification,
            category: product.category,
            standard_price: product.standardPrice,
            last_updated: new Date().toISOString()
        })
        .select()
        .single();
    if (error) throw error;
    return this.mapProductFromDB(data);
  }

  async getCustomers(): Promise<Customer[]> {
    const data = await this.fetchAllData(CONFIG.TABLES.CUSTOMERS, 'name', true);
    return data as Customer[];
  }

  async addCustomer(name: string): Promise<Customer> {
    if (!this.isConnected || !this.supabase) throw new Error("No DB");
    const { data, error } = await this.supabase.from(CONFIG.TABLES.CUSTOMERS).insert({ name }).select().single();
    if (error) throw error;
    return data as Customer;
  }

  async getTechnicians(): Promise<Technician[]> {
    const data = await this.fetchAllData(CONFIG.TABLES.TECHNICIANS, 'name', true);
    return data as Technician[];
  }

  async addTechnician(name: string): Promise<Technician> {
    if (!this.isConnected || !this.supabase) throw new Error("No DB");
    const { data, error } = await this.supabase.from(CONFIG.TABLES.TECHNICIANS).insert({ name }).select().single();
    if (error) throw error;
    return data as Technician;
  }

  async removeTechnician(id: string): Promise<void> {
    if (!this.isConnected || !this.supabase) return;
    await this.supabase.from(CONFIG.TABLES.TECHNICIANS).delete().eq('id', id);
  }

  async getOrders(): Promise<Order[]> {
    // Orders sorted by create_date desc usually
    const data = await this.fetchAllData(CONFIG.TABLES.ORDERS, 'create_date', false);
    return data.map(this.mapOrderFromDB);
  }

  async checkOrderExists(orderNumber: string): Promise<boolean> {
      if (!this.isConnected || !this.supabase) return false;
      const { count } = await this.supabase
        .from(CONFIG.TABLES.ORDERS)
        .select('*', { count: 'exact', head: true })
        .eq('order_number', orderNumber);
      return (count || 0) > 0;
  }

  async createOrders(ordersData: any[], manualOrderNumber: string): Promise<void> {
    if (!this.isConnected || !this.supabase) throw new Error("No DB Connection");

    const dbPayloads = ordersData.map(o => ({
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
        status: o.status,
        create_date: new Date().toISOString(),
        target_date: o.targetDate,
        technicians: o.technicians,
        notes: o.notes,
        is_archived: false
    }));

    const { error } = await this.supabase.from(CONFIG.TABLES.ORDERS).insert(dbPayloads);
    if (error) throw error;
  }

  async updateOrderStatusByNo(orderNumber: string, newStatus: CalibrationStatus): Promise<void> {
    if (!this.isConnected || !this.supabase) return;
    const updates: any = { status: newStatus };
    if (newStatus === CalibrationStatus.COMPLETED) {
        updates.is_archived = true;
    }
    await this.supabase.from(CONFIG.TABLES.ORDERS).update(updates).eq('order_number', orderNumber);
  }

  async updateOrderNotesByNo(orderNumber: string, notes: string): Promise<void> {
    if (!this.isConnected || !this.supabase) return;
    await this.supabase.from(CONFIG.TABLES.ORDERS).update({ notes }).eq('order_number', orderNumber);
  }

  async updateOrderTargetDateByNo(orderNumber: string, newDate: string): Promise<void> {
    if (!this.isConnected || !this.supabase) return;
    await this.supabase.from(CONFIG.TABLES.ORDERS).update({ target_date: new Date(newDate).toISOString() }).eq('order_number', orderNumber);
  }
  
  async restoreOrderByNo(orderNumber: string, reason: string): Promise<void> {
      if (!this.isConnected || !this.supabase) return;
      await this.supabase.from(CONFIG.TABLES.ORDERS).update({
            is_archived: false,
            status: CalibrationStatus.PENDING,
            resurrect_reason: reason
          }).eq('order_number', orderNumber);
  }

  async deleteOrderByNo(orderNumber: string): Promise<void> {
      if (!this.isConnected || !this.supabase) return;
      await this.supabase.from(CONFIG.TABLES.ORDERS).delete().eq('order_number', orderNumber);
  }
  
  // Compatibility shim for existing components using checkAdminPassword
  async checkAdminPassword(input: string): Promise<boolean> {
      return this.verifyAdminPassword(input);
  }
}

export const mockGasService = new SupabaseService();
