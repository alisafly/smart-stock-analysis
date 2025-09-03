import { VercelRequest, VercelResponse } from '@vercel/node';
import axios from 'axios';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 设置CORS头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  
  try {
    const { code, startDate, endDate } = req.query;
    
    // 调用实际的后端服务（这里需要替换为您的实际后端URL）
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:3002';
    const response = await axios.get(`${backendUrl}/api/stock/${code}/${startDate}/${endDate}`);
    
    res.status(200).json(response.data);
  } catch (error) {
    console.error('API调用错误:', error);
    res.status(500).json({ 
      success: false, 
      error: '服务器内部错误',
      message: '无法获取股票数据'
    });
  }
}