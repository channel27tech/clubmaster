import axios from 'axios';
import Cookies from 'js-cookie';

// Create a custom axios instance
const api = axios.create({
  baseURL: '/',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add authentication token
api.interceptors.request.use(
  (config) => {
    // Get the token from cookies
    const token = Cookies.get('authToken');
    
    // If token exists, add it to the headers
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle common errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Log the error for debugging
    console.error('API Error:', error.response?.data || error.message);
    
    // Handle specific error cases
    if (error.response) {
      // Authentication errors
      if (error.response.status === 401) {
        console.warn('Authentication error detected');
        // You could redirect to login page or trigger a refresh token flow here
      }
    }
    
    return Promise.reject(error);
  }
);

export default api; 