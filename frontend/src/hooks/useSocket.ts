import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export function useSocket() {
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Закрываем предыдущее соединение если есть
    if (socketRef.current?.connected) {
      socketRef.current.disconnect();
    }

    socketRef.current = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      // Добавляем CORS настройки
      extraHeaders: {
        'Access-Control-Allow-Origin': '*',
      },
    });

    socketRef.current.on('connect', () => {
      setIsConnected(true);
      console.log('🔗 Socket connected');
    });

    socketRef.current.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error);
      setIsConnected(false);
    });

    socketRef.current.on('disconnect', () => {
      setIsConnected(false);
      console.log('🔌 Socket disconnected');
    });

    socketRef.current.on('reconnect', () => {
      console.log('🔄 Socket reconnected');
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
      }
    };
  }, []);

  return socketRef.current;
}