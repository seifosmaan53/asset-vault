// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/layout/ProtectedRoute';
import { AdminRoute } from './components/layout/AdminRoute';
import { AuthRouteWrapper } from './components/auth/AuthRouteWrapper';
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
import InvoiceTemplateEditor from './pages/InvoiceTemplates/InvoiceTemplateEditor';
// Recurring invoices removed
import StoreList from './pages/Stores/StoreList';
import StoreForm from './pages/Stores/StoreForm';
import StoreDetail from './pages/Stores/StoreDetail';
import StoreItemSettings from './pages/Stores/StoreItemSettings';
import StoreStockReport from './pages/Stores/StoreStockReport';
import StoreAnalytics from './pages/Analytics/StoreAnalytics';
import PlanSelection from './pages/Subscription/PlanSelection';
import Billing from './pages/Subscription/Billing';
import SubscriptionSuccess from './pages/Subscription/Success';
import SubscriptionCancel from './pages/Subscription/Cancel';
import NotFound from './pages/NotFound';
import { ErrorBoundary } from './components/common/ErrorBoundary';

function App() {

  return (
    <ErrorBoundary>
      <Routes>
      <Route
        path="/login/*"
        element={
          <AuthRouteWrapper>
            <Login />
          </AuthRouteWrapper>
        }
      />
      <Route
        path="/register/*"
        element={
          <AuthRouteWrapper>
            <Register />
          </AuthRouteWrapper>
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
        <Route path="subscription/plan" element={<PlanSelection />} />
        <Route path="subscription/billing" element={<Billing />} />
        <Route path="subscription/success" element={<SubscriptionSuccess />} />
        <Route path="subscription/cancel" element={<SubscriptionCancel />} />
        <Route path="api-keys" element={<ApiKeysList />} />
        <Route path="feedback" element={<Feedback />} />
        <Route path="invoice-templates" element={<InvoiceTemplatesList />} />
        <Route path="invoice-templates/create" element={<InvoiceTemplateEditor />} />
        <Route path="invoice-templates/:id" element={<InvoiceTemplateEditor />} />
        <Route path="invoice-templates/:id/edit" element={<InvoiceTemplateEditor />} />
        {/* Recurring invoices removed */}
        <Route path="stores" element={<StoreList />} />
        <Route path="stores/new" element={<StoreForm />} />
        <Route path="stores/:id" element={<StoreDetail />} />
        <Route path="stores/:id/edit" element={<StoreForm />} />
        <Route path="stores/:id/items" element={<StoreItemSettings />} />
        <Route path="stores/:id/report" element={<StoreStockReport />} />
        <Route path="analytics/stores" element={<StoreAnalytics />} />
        <Route path="analytics/stores/:storeId" element={<StoreAnalytics />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
    </ErrorBoundary>
  );
}

export default App;
