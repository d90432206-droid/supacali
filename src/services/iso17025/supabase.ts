import { createClient } from '@supabase/supabase-js';

const supabaseUrl = (import.meta as any).env.VITE_ISO_SUPABASE_URL || "";
const supabaseKey = (import.meta as any).env.VITE_ISO_SUPABASE_ANON_KEY || "";

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * 知識庫檢索 (RAG)
 */
export async function searchKnowledge(query: string): Promise<string> {
  if (!supabaseUrl || !supabaseKey) return "Supabase 尚未設定。";

  try {
    let data: any[] | null = null;
    const docMatch = query.match(/[A-Z]{2,5}-\d{3,5}(?:-[A-Z0-9]+)?/);
    let filterDocId: string | null = null;
    let docMeta: string | null = null;

    if (docMatch) {
      let { data: docData } = await supabase
        .from('iso_documents')
        .select('id, doc_number, title')
        .eq('doc_number', docMatch[0])
        .maybeSingle();

      if (!docData) {
        const numericSuffix = docMatch[0].match(/(\d{3,5}(?:-[A-Z0-9]+)?)$/)?.[1];
        if (numericSuffix) {
          const { data: fuzzyDoc } = await supabase
            .from('iso_documents')
            .select('id, doc_number, title')
            .ilike('doc_number', `%-${numericSuffix}`)
            .maybeSingle();
          docData = fuzzyDoc ?? null;
        }
      }
      filterDocId = docData?.id ?? null;

      if (docData?.title) {
        const dateMatch = docData.title.match(/(\d{8})/);
        const verMatch  = docData.title.match(/([A-Z]\d+版)/);
        const dateStr   = dateMatch ? `${dateMatch[1].slice(0,4)}/${dateMatch[1].slice(4,6)}/${dateMatch[1].slice(6,8)}` : null;
        docMeta = `[${docData.doc_number} 文件基本資料] 版次：${verMatch?.[1] ?? '未知'}　最後修訂日期：${dateStr ?? '未知'}`;
      }
    }

    if (filterDocId) {
      const { data: chunks, error } = await supabase
        .from('iso_knowledge_chunks')
        .select('content, doc_id, chunk_index, iso_documents(doc_number, title)')
        .eq('doc_id', filterDocId)
        .order('chunk_index', { ascending: true })
        .limit(40);

      const extraKeywords = query
        .replace(/[A-Z]{2,4}-\d{3,5}/, '')
        .match(/[\u4e00-\u9fa5]{2,6}|[A-Za-z]{3,}/g) ?? [];

      if (extraKeywords.length > 0 && (chunks ?? []).length > 0) {
        const scored = (chunks ?? []).map(chunk => {
          const text = chunk.content.toLowerCase();
          const hits = extraKeywords.filter(k => text.includes(k.toLowerCase())).length;
          return { chunk, hits };
        });
        scored.sort((a, b) => b.hits - a.hits);
        data = scored.map(s => s.chunk);
      } else {
        data = chunks ?? [];
      }
    } else {
      const stopWords = new Set(['給我', '請問', '現在', '關於', '如何', '包含', '什麼', '怎麼']);
      const keywordSet = new Set<string>();
      const chineseSeqs = query.match(/[\u4e00-\u9fa5]+/g) ?? [];
      for (const seq of chineseSeqs) {
        for (let i = 0; i < seq.length; i++) {
          if (i + 2 <= seq.length) keywordSet.add(seq.slice(i, i + 2));
          if (i + 3 <= seq.length) keywordSet.add(seq.slice(i, i + 3));
        }
      }
      (query.match(/[A-Z0-9-]{3,10}/g) ?? []).forEach(k => keywordSet.add(k));
      let keywords = Array.from(keywordSet).filter(k => !stopWords.has(k)).slice(0, 10);

      const scoreMap = new Map<string, { item: any; score: number }>();
      await Promise.all(
        keywords.map(async (k) => {
          const { data: kData, error } = await supabase
            .from('iso_knowledge_chunks')
            .select('content, doc_id, iso_documents(doc_number, title)')
            .ilike('content', `%${k}%`)
            .limit(8);

          if (kData) {
            kData.forEach((item: any) => {
              const doc = item.iso_documents as any;
              const key = (doc?.doc_number ?? item.doc_id ?? '') + item.content.substring(0, 30);
              const existing = scoreMap.get(key);
              if (existing) existing.score += 1;
              else scoreMap.set(key, { item, score: 1 });
            });
          }
        })
      );

      data = Array.from(scoreMap.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 20)
        .map(entry => entry.item);
    }

    if (!data || data.length === 0) return "未在知識庫中找到匹配的條文片段內容。";

    const chunkText = data.map((item: any) => {
      const doc = item.iso_documents as any;
      const docLabel = doc?.doc_number ? `${doc.doc_number} ${doc.title ?? ''}` : '(未知文件)';
      return `[來源文件: ${docLabel}]\n${item.content}`;
    }).join('\n\n---\n\n');

    return docMeta ? `${docMeta}\n\n---\n\n${chunkText}` : chunkText;
  } catch (error) {
    console.error("Knowledge search error:", error);
    return "檢索知識庫時發生錯誤。";
  }
}
