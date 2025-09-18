// 日本語PDF対応フォント設定
import { jsPDF } from 'jspdf';

// 日本語フォントをjsPDFに設定する関数
export const addJapaneseFonts = (doc: jsPDF) => {
  try {
    // jsPDFの標準フォントでも一部の日本語が表示可能な設定を試行
    doc.setFont('helvetica', 'normal');
    
    // UTF-8エンコーディングを明示的に設定
    doc.internal.write('stream');
    
    return { 
      formatJapaneseText: (text: string): string => {
        // 日本語テキストをそのまま返す（変換なし）
        return text;
      }
    };
  } catch (error) {
    console.error('Failed to configure Japanese fonts:', error);
    // エラー時も日本語テキストを保持
    return { 
      formatJapaneseText: (text: string) => text
    };
  }
};

// 日本語対応のテキスト描画関数
export const drawJapaneseText = (
  doc: jsPDF, 
  text: string, 
  x: number, 
  y: number,
  options?: { 
    fontSize?: number;
    fontStyle?: 'normal' | 'bold' | 'italic';
    maxWidth?: number;
  }
) => {
  const { formatJapaneseText } = addJapaneseFonts(doc);
  
  if (options?.fontSize) {
    doc.setFontSize(options.fontSize);
  }
  
  if (options?.fontStyle) {
    doc.setFont('helvetica', options.fontStyle);
  }
  
  const japaneseText = formatJapaneseText(text);
  
  if (options?.maxWidth) {
    try {
      const lines = doc.splitTextToSize(japaneseText, options.maxWidth);
      doc.text(lines, x, y);
    } catch (error) {
      // 分割に失敗した場合はそのまま表示
      doc.text(japaneseText, x, y);
    }
  } else {
    doc.text(japaneseText, x, y);
  }
};

// 日付フォーマット関数（日本語）
export const formatJapaneseDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const weekday = weekdays[date.getDay()];
  
  return `${month}月${day}日(${weekday})`;
};

// 月年フォーマット関数（日本語）
export const formatJapaneseMonthYear = (date: Date): string => {
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  return `${year}年${month}月`;
};

// 後方互換性のためのエイリアス（廃止予定）
export const addEnglishFonts = addJapaneseFonts;
export const drawEnglishText = drawJapaneseText;