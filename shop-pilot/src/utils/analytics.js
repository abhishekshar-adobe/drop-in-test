/**
 * Analytics Query Utilities
 * Config-driven analytics for e-commerce metrics
 */

/**
 * Metric Detector - Detect analytics metric from user text
 * @param {string} text - User input text
 * @returns {Object} - Detected metric and field
 */
export function detectMetric(text) {
  const lowerText = text.toLowerCase();
  
  // Metric patterns with their associated operations
  const metricPatterns = [
    { metric: 'sum', patterns: ['how much', 'total spend', 'total cost', 'amount spent', 'spend'], field: 'total' },
    { metric: 'count', patterns: ['how many', 'number of', 'count'], field: 'count' },
    { metric: 'avg', patterns: ['average', 'avg', 'mean'], field: 'average' },
    { metric: 'max', patterns: ['most expensive', 'highest', 'maximum', 'max'], field: 'max' },
    { metric: 'min', patterns: ['cheapest', 'lowest', 'minimum', 'min'], field: 'min' },
    { metric: 'top', patterns: ['top', 'best selling', 'most popular'], field: 'top' },
    { metric: 'list', patterns: ['list', 'show all', 'get all'], field: 'list' }
  ];
  
  for (const pattern of metricPatterns) {
    if (pattern.patterns.some(p => lowerText.includes(p))) {
      return { metric: pattern.metric, field: pattern.field };
    }
  }
  
  // Default to list if no specific metric found
  return { metric: 'list', field: 'list' };
}

/**
 * Extract time range from user text
 * @param {string} text - User input text
 * @returns {Object|null} - Date range object or null
 */
export function extractTimeRange(text) {
  const lowerText = text.toLowerCase();
  const now = new Date();
  
  // Time range patterns
  const patterns = [
    {
      pattern: /last\s+year|past\s+year/,
      range: () => {
        const start = new Date(now.getFullYear() - 1, 0, 1);
        const end = new Date(now.getFullYear() - 1, 11, 31);
        return { start, end, label: 'last year' };
      }
    },
    {
      pattern: /this\s+year|current\s+year/,
      range: () => {
        const start = new Date(now.getFullYear(), 0, 1);
        const end = new Date(now);
        return { start, end, label: 'this year' };
      }
    },
    {
      pattern: /last\s+month|past\s+month/,
      range: () => {
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const end = new Date(now.getFullYear(), now.getMonth(), 0);
        return { start, end, label: 'last month' };
      }
    },
    {
      pattern: /this\s+month|current\s+month/,
      range: () => {
        const start = new Date(now.getFullYear(), now.getMonth(), 1);
        const end = new Date(now);
        return { start, end, label: 'this month' };
      }
    },
    {
      pattern: /last\s+(\d+)\s+days/,
      range: (match) => {
        const days = parseInt(match[1]);
        const start = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
        const end = new Date(now);
        return { start, end, label: `last ${days} days` };
      }
    },
    {
      pattern: /last\s+week|past\s+week/,
      range: () => {
        const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const end = new Date(now);
        return { start, end, label: 'last week' };
      }
    }
  ];
  
  for (const p of patterns) {
    const match = lowerText.match(p.pattern);
    if (match) {
      return p.range(match);
    }
  }
  
  return null;
}

/**
 * Build structured analytics request
 * @param {Object} params - Request parameters
 * @returns {Object} - Structured analytics request
 */
export function buildAnalyticsRequest(params) {
  const { text, metric, field, product, category, brand, timeRange } = params;
  
  const request = {
    dataset: 'orders',
    metric: metric || 'list',
    field: field || 'list',
    filters: {},
    dateRange: null,
    originalQuery: text
  };
  
  // Add filters
  if (product) {
    request.filters.product = product;
  }
  
  if (category) {
    request.filters.category = category;
  }
  
  if (brand) {
    request.filters.brand = brand;
  }
  
  // Add date range
  if (timeRange) {
    request.dateRange = {
      start: timeRange.start.toISOString(),
      end: timeRange.end.toISOString(),
      label: timeRange.label
    };
  }
  
  return request;
}

/**
 * Generic aggregation executor - Config-driven analytics
 * @param {Object} request - Analytics request object
 * @param {Array} data - Data to aggregate
 * @returns {Object} - Aggregation result
 */
export function executeAggregation(request, data) {
  const { metric, field, filters, dateRange } = request;
  
  // Step 1: Filter data
  let filteredData = data;
  
  // Apply date range filter
  if (dateRange) {
    filteredData = filteredData.filter(item => {
      const itemDate = new Date(item.order_date);
      return itemDate >= new Date(dateRange.start) && itemDate <= new Date(dateRange.end);
    });
  }
  
  // Apply product/category/brand filters
  if (filters.product) {
    filteredData = filteredData.filter(item => 
      item.items?.some(product => 
        product.product_name?.toLowerCase().includes(filters.product.toLowerCase())
      )
    );
  }
  
  if (filters.category) {
    filteredData = filteredData.filter(item => 
      item.items?.some(product => 
        product.category?.toLowerCase().includes(filters.category.toLowerCase())
      )
    );
  }
  
  if (filters.brand) {
    filteredData = filteredData.filter(item => 
      item.items?.some(product => 
        product.brand?.toLowerCase().includes(filters.brand.toLowerCase())
      )
    );
  }
  
  // Step 2: Execute aggregation based on metric
  let result;
  
  switch (metric) {
    case 'count':
      result = {
        value: filteredData.length,
        label: 'Count',
        unit: 'orders'
      };
      break;
      
    case 'sum':
      const total = filteredData.reduce((sum, item) => 
        sum + (item.total?.grand_total?.value || 0), 0
      );
      result = {
        value: total,
        label: 'Total Spend',
        unit: filteredData[0]?.total?.grand_total?.currency || 'USD'
      };
      break;
      
    case 'avg':
      const avg = filteredData.length > 0
        ? filteredData.reduce((sum, item) => sum + (item.total?.grand_total?.value || 0), 0) / filteredData.length
        : 0;
      result = {
        value: avg,
        label: 'Average',
        unit: filteredData[0]?.total?.grand_total?.currency || 'USD'
      };
      break;
      
    case 'max':
      const maxOrder = filteredData.reduce((max, item) => 
        (item.total?.grand_total?.value || 0) > (max?.total?.grand_total?.value || 0) ? item : max,
        filteredData[0]
      );
      result = {
        value: maxOrder?.total?.grand_total?.value || 0,
        label: 'Maximum',
        unit: maxOrder?.total?.grand_total?.currency || 'USD',
        order: maxOrder
      };
      break;
      
    case 'min':
      const minOrder = filteredData.reduce((min, item) => 
        (item.total?.grand_total?.value || 0) < (min?.total?.grand_total?.value || 0) ? item : min,
        filteredData[0]
      );
      result = {
        value: minOrder?.total?.grand_total?.value || 0,
        label: 'Minimum',
        unit: minOrder?.total?.grand_total?.currency || 'USD',
        order: minOrder
      };
      break;
      
    case 'top':
      const topOrders = filteredData
        .sort((a, b) => (b.total?.grand_total?.value || 0) - (a.total?.grand_total?.value || 0))
        .slice(0, 5);
      result = {
        value: topOrders.length,
        label: 'Top Orders',
        orders: topOrders
      };
      break;
      
    case 'list':
    default:
      result = {
        value: filteredData.length,
        label: 'List',
        orders: filteredData
      };
      break;
  }
  
  result.filteredCount = filteredData.length;
  result.totalCount = data.length;
  
  return result;
}

/**
 * Format analytics result for user display
 * @param {Object} request - Analytics request
 * @param {Object} result - Aggregation result
 * @returns {string} - Formatted message
 */
export function formatAnalyticsResult(request, result) {
  const { metric, filters, dateRange } = request;
  const { value, label, unit, filteredCount } = result;
  
  let message = `📊 **Analytics Result**\n\n`;
  
  // Add filters info
  const filterParts = [];
  if (filters.product) filterParts.push(`product: ${filters.product}`);
  if (filters.category) filterParts.push(`category: ${filters.category}`);
  if (filters.brand) filterParts.push(`brand: ${filters.brand}`);
  if (dateRange) filterParts.push(`time: ${dateRange.label}`);
  
  if (filterParts.length > 0) {
    message += `**Filters:** ${filterParts.join(', ')}\n\n`;
  }
  
  // Add result
  switch (metric) {
    case 'count':
      message += `**${label}:** ${value} ${unit}`;
      break;
      
    case 'sum':
    case 'avg':
    case 'max':
    case 'min':
      message += `**${label}:** ${unit} ${value.toFixed(2)}`;
      break;
      
    case 'top':
    case 'list':
      message += `**${label}:** Found ${filteredCount} matching orders`;
      break;
      
    default:
      message += `**Result:** ${value}`;
  }
  
  return message;
}
