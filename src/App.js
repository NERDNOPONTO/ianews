import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import api from './services/api';
import './App.css';
import Header from './components/Header';
import PostList from './components/PostList';
import Footer from './components/Footer';
import LoadingSpinner from './components/LoadingSpinner';
import AdSpace from './components/AdSpace';
import { telegramAutoNotification } from './services/TelegramAutoNotification';
import { getPosts } from './services/api';

function App() {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  const checkServerConnection = async () => {
    try {
      const response = await api.get('/test');
      console.log('Status do servidor:', response.data);
      setIsConnected(true);
      return true;
    } catch (err) {
      console.error('Erro ao verificar conexão com o servidor:', err);
      setIsConnected(false);
      return false;
    }
  };

  const fetchPosts = async (page = 1) => {
    try {
      setLoading(true);
      setError(null);
      
      if (!isConnected) {
        const connected = await checkServerConnection();
        if (!connected) {
          throw new Error('Não foi possível conectar ao servidor');
        }
      }
      
      console.log('Tentando buscar posts...');
      const response = await getPosts(page);
      console.log('Resposta da API:', response);
      
      setPosts(response.posts);
      setTotalPages(response.pagination.pages);
      setCurrentPage(page);
    } catch (err) {
      console.error('Erro ao buscar posts:', err);
      setError(err.message || 'Erro ao carregar posts. Por favor, tente novamente.');
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('Iniciando aplicação...');
    console.log('Ambiente:', process.env.NODE_ENV);
    
    const initializeApp = async () => {
      try {
        await checkServerConnection();
        await fetchPosts();
        telegramAutoNotification.startChecking();
      } catch (err) {
        console.error('Erro ao inicializar aplicação:', err);
        setError('Erro ao inicializar a aplicação. Por favor, tente novamente.');
      }
    };

    initializeApp();

    return () => {
      telegramAutoNotification.stopChecking();
    };
  }, []);

  const handleSearch = (query) => {
    setSearchQuery(query);
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    fetchPosts(page);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <p>Carregando posts...</p>
      </div>
    );
  }

  return (
    <Router basename={window.basename}>
      <div className="App">
        <Header onSearch={handleSearch} />
        <main className="main-content">
          <div className="content-wrapper">
            <AdSpace position="top" />
            {error ? (
              <div className="error-container">
                <p className="error-message">{error}</p>
                <button onClick={() => fetchPosts(currentPage)} className="retry-button">
                  Tentar Novamente
                </button>
              </div>
            ) : (
              <>
                <PostList 
                  posts={posts} 
                  currentPage={currentPage} 
                  totalPages={totalPages} 
                  onPageChange={handlePageChange}
                />
                <AdSpace />
              </>
            )}
          </div>
        </main>
        <Footer />
      </div>
    </Router>
  );
}

export default App;