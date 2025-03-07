require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const postsRouter = require('./routes/posts');
const configRouter = require('./routes/config');
const Config = require('./models/Config');

const app = express();

// Configuração do CORS
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'https://nerdnoponto.github.io/IA-the-News/',
    'http://localhost:3000'
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  credentials: true
}));

// Middlewares
app.use(express.json());

// Log de requisições
app.use((req, res, next) => {
  console.log('=== Nova Requisição ===');
  console.log('Data:', new Date().toISOString());
  console.log('Método:', req.method);
  console.log('URL:', req.url);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));
  console.log('Query:', JSON.stringify(req.query, null, 2));
  console.log('Body:', JSON.stringify(req.body, null, 2));
  console.log('=====================');
  next();
});

// Rota raiz
app.get('/', (req, res) => {
  res.json({
    message: 'Bem-vindo à API do Blog!',
    status: 'online',
    endpoints: {
      posts: '/api/posts',
      config: '/api/config',
      test: '/test'
    }
  });
});

// Função para obter a chave da API
const getOpenAIKey = async () => {
  try {
    const config = await Config.findOne({ key: 'OPENAI_API_KEY' });
    return config ? config.value : process.env.OPENAI_API_KEY;
  } catch (error) {
    console.error('Erro ao obter chave da API:', error);
    return process.env.OPENAI_API_KEY;
  }
};

// Rota de teste
app.get('/test', (req, res) => {
  console.log('Teste de conexão recebido');
  res.json({ 
    message: 'API está funcionando!',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    mongoStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    headers: req.headers
  });
});

// Conexão com MongoDB com retry
const connectWithRetry = async () => {
  try {
    console.log('=== Tentando conectar ao MongoDB ===');
    console.log('Ambiente:', process.env.NODE_ENV);
    console.log('URI definida:', !!process.env.MONGO_URI);
    
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI não está definida nas variáveis de ambiente');
    }
    
    await mongoose.connect(process.env.MONGO_URI, { 
      useNewUrlParser: true, 
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4
    });
    
    console.log('MongoDB conectado com sucesso');
    console.log('Estado da conexão:', mongoose.connection.readyState);
    
    // Criar configuração inicial da API se não existir
    const apiKey = await Config.findOne({ key: 'OPENAI_API_KEY' });
    if (!apiKey && process.env.OPENAI_API_KEY) {
      await Config.create({
        key: 'OPENAI_API_KEY',
        value: process.env.OPENAI_API_KEY,
        description: 'Chave da API da OpenAI'
      });
      console.log('Chave da API inicial configurada');
    }
  } catch (err) {
    console.error('Erro ao conectar ao MongoDB:', {
      message: err.message,
      code: err.code,
      name: err.name
    });
    console.log('Tentando reconectar em 5 segundos...');
    setTimeout(connectWithRetry, 5000);
  }
};

// Monitora mudanças na conexão
mongoose.connection.on('connected', () => {
  console.log('MongoDB conectado');
});

mongoose.connection.on('error', (err) => {
  console.error('Erro na conexão MongoDB:', err);
});

mongoose.connection.on('disconnected', () => {
  console.log('MongoDB desconectado');
});

// Inicia a conexão
connectWithRetry();

// Middleware de tratamento de erros
const errorHandler = (err, req, res, next) => {
  console.error('Erro detalhado:', {
    message: err.message,
    stack: err.stack,
    name: err.name,
    code: err.code
  });
  
  res.status(500).json({
    error: 'Erro interno do servidor',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Ocorreu um erro ao processar sua requisição'
  });
};

// Rotas
app.use('/api/posts', postsRouter);
app.use('/api/config', configRouter);

// Middleware de tratamento de erros
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`URL do servidor: http://localhost:${PORT}`);
  console.log('Configurações:', {
    nodeEnv: process.env.NODE_ENV,
    port: PORT,
    mongoUri: process.env.MONGO_URI ? 'definida' : 'não definida',
    openaiKey: process.env.OPENAI_API_KEY ? 'definida' : 'não definida'
  });
});