/**
 * main.jsx - Entry point de la aplicación
 */
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { 
  AuthProvider, 
  ExpensesProvider, 
  FriendsProvider, 
  DebtsProvider, 
  UIProvider,
  NotificationsProvider
} from './context';
import './styles/globals.css';
import './styles/components.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <UIProvider>
      <AuthProvider>
        <NotificationsProvider>
          <FriendsProvider>
            <ExpensesProvider>
              <DebtsProvider>
                <App />
              </DebtsProvider>
            </ExpensesProvider>
          </FriendsProvider>
        </NotificationsProvider>
      </AuthProvider>
    </UIProvider>
  </StrictMode>,
);
