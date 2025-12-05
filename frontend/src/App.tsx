import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import ProtectedRoute from './components/layout/ProtectedRoute';
import AuthLayout from './components/layout/AuthLayout';
import AppLayout from './components/layout/AppLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ClientsList from './pages/Clients/ClientsList';
import ClientDetail from './pages/Clients/ClientDetail';
import ClientForm from './pages/Clients/ClientForm';
import InventoryList from './pages/Inventory/InventoryList';
import InventoryForm from './pages/Inventory/InventoryForm';
import InventoryDetail from './pages/Inventory/InventoryDetail';
import InvoicesList from './pages/Invoices/InvoicesList';
import InvoiceForm from './pages/Invoices/InvoiceForm';
import InvoiceDetail from './pages/Invoices/InvoiceDetail';
import InvoicePreview from './pages/Invoices/InvoicePreview';
import Settings from './pages/Settings/Settings';
import ApiKeysList from './pages/ApiKeys/ApiKeysList';
import Feedback from './pages/Feedback/Feedback';
import InvoiceTemplatesList from './pages/InvoiceTemplates/InvoiceTemplatesList';
import RecurringInvoicesList from './pages/RecurringInvoices/RecurringInvoicesList';
import RecurringInvoiceForm from './pages/RecurringInvoices/RecurringInvoiceForm';

function App() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  return (
    <Routes>
      <Route
        path="/login"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <AuthLayout>
              <Login />
            </AuthLayout>
          )
        }
      />
      <Route
        path="/register"
        element={
          isAuthenticated ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <AuthLayout>
              <Register />
            </AuthLayout>
          )
        }
      />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="clients" element={<ClientsList />} />
        <Route path="clients/create" element={<ClientForm />} />
        <Route path="clients/:id" element={<ClientDetail />} />
        <Route path="clients/:id/edit" element={<ClientForm />} />
        <Route path="inventory" element={<InventoryList />} />
        <Route path="inventory/create" element={<InventoryForm />} />
        <Route path="inventory/:id" element={<InventoryDetail />} />
        <Route path="inventory/:id/edit" element={<InventoryForm />} />
        <Route path="invoices" element={<InvoicesList />} />
        <Route path="invoices/create" element={<InvoiceForm />} />
        <Route path="invoices/:id" element={<InvoiceDetail />} />
        <Route path="invoices/:id/edit" element={<InvoiceForm />} />
        <Route path="invoices/:id/preview" element={<InvoicePreview />} />
        <Route path="settings" element={<Settings />} />
        <Route path="api-keys" element={<ApiKeysList />} />
        <Route path="feedback" element={<Feedback />} />
        <Route path="templates" element={<InvoiceTemplatesList />} />
        <Route path="recurring-invoices" element={<RecurringInvoicesList />} />
        <Route path="recurring-invoices/create" element={<RecurringInvoiceForm />} />
        <Route path="recurring-invoices/:id" element={<RecurringInvoiceForm />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
