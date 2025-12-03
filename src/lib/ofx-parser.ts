/**
 * Enhanced OFX Parser for Brazilian Banks
 * Supports: Nubank, Itaú, Bradesco, Banco do Brasil, Santander, Inter, C6 Bank, BTG, XP, etc.
 * Handles both credit card (CREDITCARDMSGSRSV1) and bank account (BANKMSGSRSV1) formats
 */

export interface OFXTransaction {
  date: string;
  amount: number;
  description: string;
  name: string | null;
  fitid: string | null;
  type: 'debito' | 'credito';
  transactionType: string | null; // DEBIT, CREDIT, XFER, PAYMENT, etc.
  checkNum: string | null;
  refNum: string | null;
  memo: string | null;
}

export interface OFXAccountInfo {
  bankId: string | null;
  branchId: string | null;
  accountId: string | null;
  accountType: string | null;
  currency: string | null;
}

export interface OFXParseResult {
  transactions: OFXTransaction[];
  dtStart: string;
  dtEnd: string;
  account: OFXAccountInfo;
  balance: number | null;
  balanceDate: string | null;
  organization: string | null;
  fid: string | null;
}

// Brazilian bank identifiers
const BRAZILIAN_BANKS: Record<string, string> = {
  '001': 'Banco do Brasil',
  '033': 'Santander',
  '104': 'Caixa Econômica Federal',
  '237': 'Bradesco',
  '341': 'Itaú',
  '260': 'Nubank',
  '077': 'Inter',
  '336': 'C6 Bank',
  '208': 'BTG Pactual',
  '102': 'XP Investimentos',
  '212': 'Banco Original',
  '756': 'Sicoob',
  '748': 'Sicredi',
  '422': 'Safra',
  '746': 'Modal',
  '655': 'Votorantim',
  '070': 'BRB',
  '136': 'Unicred',
};

// Transaction type mappings
const TRANSACTION_TYPES: Record<string, string> = {
  'CREDIT': 'Crédito',
  'DEBIT': 'Débito',
  'INT': 'Juros',
  'DIV': 'Dividendos',
  'FEE': 'Taxa',
  'SRVCHG': 'Taxa de Serviço',
  'DEP': 'Depósito',
  'ATM': 'Saque ATM',
  'POS': 'Compra Débito',
  'XFER': 'Transferência',
  'CHECK': 'Cheque',
  'PAYMENT': 'Pagamento',
  'CASH': 'Dinheiro',
  'DIRECTDEP': 'Depósito Direto',
  'DIRECTDEBIT': 'Débito Direto',
  'REPEATPMT': 'Pagamento Recorrente',
  'HOLD': 'Bloqueio',
  'OTHER': 'Outros',
};

/**
 * Parse OFX date format with timezone support
 * Formats: YYYYMMDD, YYYYMMDDHHMMSS, YYYYMMDDHHMMSS.XXX, YYYYMMDDHHMMSS[-3:BRT]
 */
function parseOfxDate(ofxDate: string | null | undefined): string {
  if (!ofxDate) return new Date().toISOString().split('T')[0];
  
  // Clean the date string - remove timezone info and milliseconds
  let cleanDate = ofxDate.toString().trim();
  
  // Remove timezone like [-3:BRT] or [0:GMT]
  cleanDate = cleanDate.split('[')[0];
  
  // Remove milliseconds like .XXX
  cleanDate = cleanDate.split('.')[0];
  
  // Ensure we have at least 8 characters for YYYYMMDD
  if (cleanDate.length < 8) {
    console.warn('Invalid OFX date format:', ofxDate);
    return new Date().toISOString().split('T')[0];
  }
  
  const year = cleanDate.substring(0, 4);
  const month = cleanDate.substring(4, 6);
  const day = cleanDate.substring(6, 8);
  
  // Validate date components
  const yearNum = parseInt(year);
  const monthNum = parseInt(month);
  const dayNum = parseInt(day);
  
  if (yearNum < 1900 || yearNum > 2100 || monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
    console.warn('Invalid OFX date values:', { year, month, day, original: ofxDate });
    return new Date().toISOString().split('T')[0];
  }
  
  return `${year}-${month}-${day}`;
}

/**
 * Extract value from an OFX tag - handles both SGML and XML formats
 * Supports: <TAG>value, <TAG>value</TAG>, and multiline values
 */
function extractTagValue(content: string, tagName: string): string | null {
  // Try XML format first: <TAG>value</TAG>
  const xmlRegex = new RegExp(`<${tagName}>\\s*([\\s\\S]*?)\\s*</${tagName}>`, 'i');
  const xmlMatch = content.match(xmlRegex);
  if (xmlMatch && xmlMatch[1].trim()) return xmlMatch[1].trim();
  
  // Try SGML format (no closing tag): <TAG>value followed by newline or another tag
  // This is more permissive for OFX files
  const sgmlRegex = new RegExp(`<${tagName}>\\s*([^<\\r\\n]+)`, 'i');
  const sgmlMatch = content.match(sgmlRegex);
  if (sgmlMatch && sgmlMatch[1].trim()) return sgmlMatch[1].trim();
  
  // Try even more permissive: value might be on next line
  const multilineRegex = new RegExp(`<${tagName}>\\s*\\n?([^<]+)`, 'i');
  const multilineMatch = content.match(multilineRegex);
  if (multilineMatch && multilineMatch[1].trim()) return multilineMatch[1].trim();
  
  return null;
}

/**
 * Extract all values for a repeated tag
 */
function extractAllTagValues(content: string, tagName: string): string[] {
  const values: string[] = [];
  const regex = new RegExp(`<${tagName}>([^<\\r\\n]+)`, 'gi');
  let match;
  while ((match = regex.exec(content)) !== null) {
    values.push(match[1].trim());
  }
  return values;
}

/**
 * Clean and normalize description text
 * Removes extra spaces, normalizes encoding issues
 */
function cleanDescription(text: string | null): string {
  if (!text) return 'Transação sem descrição';
  
  return text
    .replace(/\s+/g, ' ')           // Normalize multiple spaces
    .replace(/^\s+|\s+$/g, '')      // Trim
    .replace(/&amp;/g, '&')         // Decode HTML entities
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .substring(0, 255);             // Limit length
}

/**
 * Parse amount from various formats
 * Handles: 1234.56, -1234.56, 1234,56, -1.234,56
 */
function parseAmount(amountStr: string | null): number {
  if (!amountStr) return 0;
  
  let cleaned = amountStr.toString().trim();
  
  // Determine decimal separator
  const hasCommaDecimal = /,\d{2}$/.test(cleaned);
  const hasDotDecimal = /\.\d{2}$/.test(cleaned);
  
  if (hasCommaDecimal && !hasDotDecimal) {
    // Brazilian format: 1.234,56
    cleaned = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (hasDotDecimal && cleaned.includes(',')) {
    // Mixed format with comma as thousands: 1,234.56
    cleaned = cleaned.replace(/,/g, '');
  }
  
  // Remove any remaining non-numeric characters except . and -
  cleaned = cleaned.replace(/[^\d.\-]/g, '');
  
  return parseFloat(cleaned) || 0;
}

/**
 * Extract single transaction from STMTTRN block
 */
function parseTransaction(transBlock: string): OFXTransaction | null {
  const dtPosted = extractTagValue(transBlock, 'DTPOSTED');
  const trnAmt = extractTagValue(transBlock, 'TRNAMT');
  
  // Need at least a date or amount to be valid
  if (!dtPosted && !trnAmt) {
    console.log("Transaction missing both date and amount");
    return null;
  }
  
  const memo = extractTagValue(transBlock, 'MEMO');
  const name = extractTagValue(transBlock, 'NAME');
  const fitid = extractTagValue(transBlock, 'FITID');
  const trnType = extractTagValue(transBlock, 'TRNTYPE');
  const checkNum = extractTagValue(transBlock, 'CHECKNUM');
  const refNum = extractTagValue(transBlock, 'REFNUM');
  
  const amount = parseAmount(trnAmt);
  
  // Build description from available fields
  let description = '';
  if (memo && name) {
    // Avoid duplicating if memo contains name
    if (memo.toLowerCase().includes(name.toLowerCase())) {
      description = memo;
    } else {
      description = `${name} - ${memo}`;
    }
  } else {
    description = memo || name || 'Transação';
  }
  
  const parsedDate = parseOfxDate(dtPosted);
  
  return {
    date: parsedDate,
    amount: Math.abs(amount),
    description: cleanDescription(description),
    name: name ? cleanDescription(name) : null,
    fitid: fitid || null,
    type: amount < 0 ? 'debito' : 'credito',
    transactionType: trnType || null,
    checkNum: checkNum || null,
    refNum: refNum || null,
    memo: memo ? cleanDescription(memo) : null,
  };
}

/**
 * Extract all transactions from OFX content
 */
function extractTransactions(content: string): OFXTransaction[] {
  const transactions: OFXTransaction[] = [];
  
  console.log("Looking for STMTTRN blocks...");
  
  // Strategy 1: Match <STMTTRN>...</STMTTRN> (XML format with closing tag)
  const xmlRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
  let matches = [...content.matchAll(xmlRegex)];
  
  console.log("XML format matches:", matches.length);
  
  for (const match of matches) {
    const trans = parseTransaction(match[1]);
    if (trans) transactions.push(trans);
  }
  
  // Strategy 2: If no XML matches, try SGML format (no closing tags)
  if (transactions.length === 0) {
    console.log("Trying SGML format parsing...");
    
    // Split by <STMTTRN> and process each block
    const parts = content.split(/<STMTTRN>/i);
    
    console.log("Found STMTTRN blocks:", parts.length - 1);
    
    for (let i = 1; i < parts.length; i++) {
      // Find the end of this transaction block
      const part = parts[i];
      let endIndex = part.length;
      
      // Look for next transaction or end markers
      const endMarkers = [
        /<STMTTRN>/i,
        /<\/STMTTRN>/i,
        /<\/BANKTRANLIST>/i,
        /<\/STMTRS>/i,
        /<\/CCSTMTRS>/i,
        /<LEDGERBAL>/i,
        /<AVAILBAL>/i,
      ];
      
      for (const marker of endMarkers) {
        const idx = part.search(marker);
        if (idx > 0) endIndex = Math.min(endIndex, idx);
      }
      
      const transBlock = part.substring(0, endIndex);
      const trans = parseTransaction(transBlock);
      if (trans) {
        transactions.push(trans);
      } else {
        console.log("Failed to parse transaction block:", transBlock.substring(0, 200));
      }
    }
  }
  
  console.log("Total transactions extracted:", transactions.length);
  return transactions;
}

/**
 * Extract account information from OFX content
 */
function extractAccountInfo(content: string): OFXAccountInfo {
  return {
    bankId: extractTagValue(content, 'BANKID'),
    branchId: extractTagValue(content, 'BRANCHID'),
    accountId: extractTagValue(content, 'ACCTID'),
    accountType: extractTagValue(content, 'ACCTTYPE'),
    currency: extractTagValue(content, 'CURDEF'),
  };
}

/**
 * Extract balance information
 */
function extractBalance(content: string): { balance: number | null; balanceDate: string | null } {
  // Try LEDGERBAL first
  const ledgerBal = extractTagValue(content, 'BALAMT');
  const ledgerDate = extractTagValue(content, 'DTASOF');
  
  // Try AVAILBAL as fallback
  const availBal = extractTagValue(content, 'AVAILBAL');
  
  let balance: number | null = null;
  if (ledgerBal) {
    balance = parseAmount(ledgerBal);
  } else if (availBal) {
    balance = parseAmount(availBal);
  }
  
  return {
    balance,
    balanceDate: ledgerDate ? parseOfxDate(ledgerDate) : null,
  };
}

/**
 * Normalize OFX content - strip headers and clean up
 */
function normalizeOFXContent(content: string): string {
  let normalized = content;
  
  // Normalize line endings
  normalized = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  
  // Find the start of OFX data (skip SGML headers)
  // Look for <OFX> tag which marks the start of actual OFX data
  const ofxStart = normalized.search(/<OFX[\s>]/i);
  if (ofxStart > 0) {
    normalized = normalized.substring(ofxStart);
  }
  
  // Try to detect and handle encoding issues (ISO-8859-1 vs UTF-8)
  // Common in Brazilian bank files
  if (content.includes('CHARSET:ISO-8859-1') || content.includes('CHARSET:1252') || 
      content.includes('CHARSET=ISO-8859-1') || content.includes('CHARSET=1252')) {
    // Content might have encoding issues - try to clean common problems
    normalized = normalized
      .replace(/Ã£/g, 'ã')
      .replace(/Ã©/g, 'é')
      .replace(/Ã§/g, 'ç')
      .replace(/Ãµ/g, 'õ')
      .replace(/Ã¡/g, 'á')
      .replace(/Ã­/g, 'í')
      .replace(/Ãº/g, 'ú')
      .replace(/Ã³/g, 'ó')
      .replace(/Ã¢/g, 'â')
      .replace(/Ãª/g, 'ê')
      .replace(/Ã´/g, 'ô');
  }
  
  return normalized;
}

/**
 * Main parse function - handles all Brazilian bank formats
 */
export function parseOFX(content: string): OFXParseResult {
  // Normalize and clean content
  const normalizedContent = normalizeOFXContent(content);
  
  console.log("Parsing OFX content, length:", normalizedContent.length);
  
  // Extract date range from BANKTRANLIST
  const dtStart = extractTagValue(normalizedContent, 'DTSTART') || '';
  const dtEnd = extractTagValue(normalizedContent, 'DTEND') || '';
  
  // Extract account info
  const account = extractAccountInfo(normalizedContent);
  
  // Extract balance
  const { balance, balanceDate } = extractBalance(normalizedContent);
  
  // Extract organization info
  const organization = extractTagValue(normalizedContent, 'ORG');
  const fid = extractTagValue(normalizedContent, 'FID');
  
  // Extract transactions
  const transactions = extractTransactions(normalizedContent);
  
  console.log("Extracted transactions:", transactions.length);
  
  // Sort transactions by date (newest first)
  transactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  
  return {
    transactions,
    dtStart: parseOfxDate(dtStart),
    dtEnd: parseOfxDate(dtEnd),
    account,
    balance,
    balanceDate,
    organization,
    fid,
  };
}

/**
 * Validate if content looks like an OFX file
 * More tolerant validation for Brazilian bank files
 */
export function isValidOFX(content: string): boolean {
  if (!content || content.length < 50) return false;
  
  const upperContent = content.toUpperCase();
  
  // Check for OFX header markers (very flexible)
  const hasOFXHeader = upperContent.includes('OFXHEADER') || 
                       upperContent.includes('<OFX>') ||
                       upperContent.includes('<OFX') ||
                       upperContent.includes('DATA:OFXSGML') ||
                       upperContent.includes('DATA:OFX');
  
  // Check for transaction data markers
  const hasTransactionData = upperContent.includes('BANKTRANLIST') || 
                             upperContent.includes('STMTTRN') ||
                             upperContent.includes('CCSTMTRS') ||
                             upperContent.includes('STMTRS');
  
  // Check for bank/account markers
  const hasBankData = upperContent.includes('BANKMSGSRSV1') ||
                      upperContent.includes('CREDITCARDMSGSRSV1') ||
                      upperContent.includes('ACCTID') ||
                      upperContent.includes('BANKID') ||
                      upperContent.includes('CURDEF');
  
  // Check for any transaction-like content (fallback)
  const hasTransactionContent = upperContent.includes('DTPOSTED') ||
                                upperContent.includes('TRNAMT') ||
                                upperContent.includes('FITID');
  
  return hasOFXHeader || hasTransactionData || (hasBankData && hasTransactionContent);
}

/**
 * Get Brazilian bank name from bank ID
 */
export function getBrazilianBankName(bankId: string | null): string | null {
  if (!bankId) return null;
  // Remove leading zeros and lookup
  const cleanId = bankId.replace(/^0+/, '');
  return BRAZILIAN_BANKS[cleanId] || BRAZILIAN_BANKS[bankId] || null;
}

/**
 * Get transaction type display name
 */
export function getTransactionTypeName(type: string | null): string {
  if (!type) return 'Outros';
  return TRANSACTION_TYPES[type.toUpperCase()] || type;
}

/**
 * Detect the bank from OFX content
 */
export function detectBank(content: string): string | null {
  const result = parseOFX(content);
  
  // Try to identify by FID
  if (result.fid) {
    const bankName = getBrazilianBankName(result.fid);
    if (bankName) return bankName;
  }
  
  // Try to identify by BANKID
  if (result.account.bankId) {
    const bankName = getBrazilianBankName(result.account.bankId);
    if (bankName) return bankName;
  }
  
  // Try to identify by ORG name
  if (result.organization) {
    const orgUpper = result.organization.toUpperCase();
    if (orgUpper.includes('NUBANK')) return 'Nubank';
    if (orgUpper.includes('ITAU') || orgUpper.includes('ITAÚ')) return 'Itaú';
    if (orgUpper.includes('BRADESCO')) return 'Bradesco';
    if (orgUpper.includes('SANTANDER')) return 'Santander';
    if (orgUpper.includes('BANCO DO BRASIL') || orgUpper.includes('BB')) return 'Banco do Brasil';
    if (orgUpper.includes('CAIXA') || orgUpper.includes('CEF')) return 'Caixa Econômica Federal';
    if (orgUpper.includes('INTER')) return 'Inter';
    if (orgUpper.includes('C6')) return 'C6 Bank';
    if (orgUpper.includes('BTG')) return 'BTG Pactual';
    if (orgUpper.includes('XP')) return 'XP Investimentos';
  }
  
  return null;
}
