import { parseIndexKey } from './treeUtils';

export const FORMULA_LETTERS = 'abcdefghijklmno'.split('');
export const FORMULA_HINT = '注：计算公式(仅支持 加减乘除 和 英文括号)：+-*/()，例如：(a*2/5+b)*c-3';

export function isCalculatedSource(index) {
  return String((index && index.指标来源) || '') === '计算指标';
}

export function cleanFormula(formula) {
  return String(formula || '')
    .replace(/\s/g, '')
    .replace(/（/g, '(')
    .replace(/）/g, ')');
}

// 返回错误信息，合法时返回空字符串
export function validateFormula(formula, availableLetters) {
  const value = cleanFormula(formula);
  if (!value) {
    return '请输入计算公式';
  }
  if (/[^a-o0-9.+\-*/()]/.test(value)) {
    return '计算公式只能包含 a-o 字母、数字、+-*/ 和英文括号';
  }
  let depth = 0;
  for (let i = 0; i < value.length; i += 1) {
    if (value[i] === '(') depth += 1;
    if (value[i] === ')') depth -= 1;
    if (depth < 0) return '计算公式括号不匹配';
  }
  if (depth !== 0) {
    return '计算公式括号不匹配';
  }
  if (/[a-o]{2}/.test(value)) {
    return '指标字母之间缺少运算符';
  }
  const used = getUsedLetters(value);
  if (!used.length) {
    return '公式中至少需要包含一个指标字母（a-o）';
  }
  const invalid = used.filter(letter => availableLetters.indexOf(letter) === -1);
  if (invalid.length) {
    return `公式中包含无效的字母: ${invalid.join(', ')}`;
  }
  return '';
}

export function getUsedLetters(formula) {
  const letters = [];
  (cleanFormula(formula).match(/[a-o]/g) || []).forEach((letter) => {
    if (letters.indexOf(letter) === -1) letters.push(letter);
  });
  return letters;
}

// 依赖列表 [{letter, key, 指标名称}] 与计算配置 childIndex 互转
export function dependenciesToChildIndex(dependencies) {
  const childIndex = {};
  (dependencies || []).forEach((item) => {
    childIndex[item.letter] = { key: item.key, 指标名称: item.指标名称 };
  });
  return childIndex;
}

export function childIndexToDependencies(childIndex) {
  return Object.keys(childIndex || {}).sort().map(letter => ({
    letter,
    key: childIndex[letter].key,
    指标名称: childIndex[letter].指标名称,
  }));
}

export function addDependency(dependencies, index) {
  const items = dependencies || [];
  if (!index || !index.key || items.some(item => item.key === index.key)) {
    return items;
  }
  const used = new Set(items.map(item => item.letter));
  const letter = FORMULA_LETTERS.find(item => !used.has(item));
  if (!letter) return items;
  return items.concat({ letter, key: index.key, 指标名称: index.指标名称 });
}

export function removeDependency(dependencies, letter) {
  return (dependencies || []).filter(item => item.letter !== letter);
}

function quoteIdentifier(name) {
  return `[${String(name).replace(/]/g, ']]')}]`;
}

function quoteTable(key) {
  const parsed = parseIndexKey(key);
  if (!parsed) {
    throw new Error('依赖指标标识无效');
  }
  return `${quoteIdentifier(parsed.database)}.dbo.${quoteIdentifier(parsed.dataTable)}`;
}

// 按公式生成 SQL：首个字母为主表，其余按日期关联；结果列固定为 日期/价格
export function generateSqlFromFormula(formula, childIndex, fields) {
  const value = cleanFormula(formula);
  const letters = getUsedLetters(value);
  if (!letters.length) {
    throw new Error('公式中至少需要包含一个指标字母（a-o）');
  }
  const date = quoteIdentifier(fields.dateField);
  const name = quoteIdentifier(fields.indexNameField);
  const valueField = quoteIdentifier(fields.valueField);
  const first = letters[0];
  const expression = value.replace(/[a-o]/g, letter => `${letter}.${valueField}`);
  const joins = letters.slice(1).map(letter =>
    `join ${quoteTable(childIndex[letter].key)} as ${letter} on ${first}.${date}=${letter}.${date}`);
  const conditions = letters.map((letter) => {
    const indexName = String(childIndex[letter].指标名称 || '').replace(/'/g, "''");
    return `${letter}.${name}='${indexName}'`;
  });
  return [
    `SELECT ${first}.${date} as 日期, ${expression} as 价格`,
    `FROM ${quoteTable(childIndex[first].key)} as ${first}`,
    ...joins,
    `WHERE ${conditions.join(' and ')}`,
  ].join(' ');
}

// 只保留公式引用的依赖，并把字母重排为 a、b、c...
export function normalizeFormulaDependencies(formula, dependencies) {
  const value = cleanFormula(formula);
  const used = new Set(getUsedLetters(value));
  const kept = (dependencies || []).filter(item => used.has(item.letter));
  const letterMap = {};
  kept.forEach((item, i) => {
    letterMap[item.letter] = FORMULA_LETTERS[i];
  });
  return {
    formula: value.replace(/[a-o]/g, letter => letterMap[letter] || letter),
    dependencies: kept.map((item, i) => ({ ...item, letter: FORMULA_LETTERS[i] })),
  };
}

export function formatSqlForDisplay(sql) {
  const literals = [];
  let formatted = String(sql || '').trim().replace(
    /'(?:''|[^'])*'/g,
    (literal) => {
      literals.push(literal);
      return `__SQL_LITERAL_${literals.length - 1}__`;
    },
  );
  if (!formatted) return '';
  formatted = formatted
    .replace(/\s+/g, ' ')
    .replace(/\s+(UNION\s+ALL|UNION)\s+/gi, '\n$1\n')
    .replace(/\s+((?:LEFT|RIGHT|FULL|INNER|CROSS)?\s*(?:OUTER\s+)?JOIN)\s+/gi, '\n$1 ')
    .replace(/\s+(FROM|WHERE|GROUP\s+BY|ORDER\s+BY|HAVING)\s+/gi, '\n$1 ')
    .replace(/\s+(ON)\s+/gi, '\n  $1 ')
    .replace(/\s+(AND|OR)\s+/gi, '\n  $1 ');
  return formatted.replace(/__SQL_LITERAL_(\d+)__/g, (match, i) => literals[Number(i)] || match);
}
