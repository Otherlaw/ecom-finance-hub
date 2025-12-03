/**
 * Simple OFX Parser for browser environments
 * Parses OFX/QFX files without relying on Node.js EventEmitter
 */

export interface OFXTransaction {
  date: string;
  amount: number;
  description: string;
  name: string | null;
  fitid: string | null;
  type: 'debito' | 'credito';
}

export interface OFXParseResult {
  transactions: OFXTransaction[];
  dtStart: string;
  dtEnd: string;
  accountId?: string;
  bankId?: string;
}

/**
 * Parse OFX date format (YYYYMMDDHHMMSS or YYYYMMDD) to ISO date string
 */
function parseOfxDate(ofxDate: string): string {
  if (!ofxDate) return new Date().toISOString().split('T')[0];
  
  // Remove timezone info if present (e.g., "20240515120000[-3:BRT]")
  const cleanDate = ofxDate.split('[')[0].trim();
  
  if (cleanDate.length < 8) return new Date().toISOString().split('T')[0];
  
  const year = cleanDate.substring(0, 4);
  const month = cleanDate.substring(4, 6);
  const day = cleanDate.substring(6, 8);
  
  return `${year}-${month}-${day}`;
}

/**
 * Extract value from an OFX tag
 */
function extractTagValue(content: string, tagName: string): string | null {
  // OFX uses SGML-like format: <TAGNAME>value (no closing tag for simple values)
  const regex = new RegExp(`<${tagName}>([^<\\r\\n]+)`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : null;
}

/**
 * Extract all transactions from OFX content
 */
function extractTransactions(content: string): OFXTransaction[] {
  const transactions: OFXTransaction[] = [];
  
  // Find all STMTTRN blocks (transaction records)
  const transactionRegex = /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRANLIST>|<\/STMTTRN>|$)/gi;
  const matches = content.matchAll(transactionRegex);
  
  for (const match of matches) {
    const transBlock = match[1];
    
    const dtPosted = extractTagValue(transBlock, 'DTPOSTED');
    const trnAmt = extractTagValue(transBlock, 'TRNAMT');
    const memo = extractTagValue(transBlock, 'MEMO');
    const name = extractTagValue(transBlock, 'NAME');
    const fitid = extractTagValue(transBlock, 'FITID');
    
    if (dtPosted && trnAmt) {
      const amount = parseFloat(trnAmt) || 0;
      
      transactions.push({
        date: parseOfxDate(dtPosted),
        amount: Math.abs(amount),
        description: memo || name || 'Transação sem descrição',
        name: name || null,
        fitid: fitid || null,
        type: amount < 0 ? 'debito' : 'credito',
      });
    }
  }
  
  return transactions;
}

/**
 * Parse OFX content and extract transactions
 */
export function parseOFX(content: string): OFXParseResult {
  // Normalize line endings
  const normalizedContent = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Extract date range from BANKTRANLIST
  const dtStart = extractTagValue(normalizedContent, 'DTSTART') || '';
  const dtEnd = extractTagValue(normalizedContent, 'DTEND') || '';
  
  // Extract account info (optional)
  const accountId = extractTagValue(normalizedContent, 'ACCTID');
  const bankId = extractTagValue(normalizedContent, 'BANKID');
  
  // Extract transactions
  const transactions = extractTransactions(normalizedContent);
  
  return {
    transactions,
    dtStart: parseOfxDate(dtStart),
    dtEnd: parseOfxDate(dtEnd),
    accountId: accountId || undefined,
    bankId: bankId || undefined,
  };
}

/**
 * Validate if content looks like an OFX file
 */
export function isValidOFX(content: string): boolean {
  const hasOFXHeader = content.includes('OFXHEADER') || content.includes('<OFX>');
  const hasBankTranList = content.includes('BANKTRANLIST') || content.includes('STMTTRN');
  return hasOFXHeader || hasBankTranList;
}
