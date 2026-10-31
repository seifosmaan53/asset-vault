// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Routes, Route, Navigate } from 'react-router-dom';
import ProtectedRoute from './components/layout/ProtectedRoute';
import { AuthRouteWrapper } from './components/auth/AuthRouteWrapper';
import AppLayout from './components/layout/AppLayout';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { RoutePage } from './components/common/LazyRoute';
import { lazyWithRetry } from './utils/lazyWithRetry';

// Every page is a separate chunk, fetched the first time its route renders.
const Login = lazyWithRetry(() => import('./pages/Login'));
const Register = lazyWithRetry(() => import('./pages/Register'));
const Dashboard = lazyWithRetry(() => import('./pages/Dashboard'));
const ClientsList = lazyWithRetry(() => import('./pages/Clients/ClientsList'));
const ClientDetail = lazyWithRetry(() => import('./pages/Clients/ClientDetail'));
const ClientForm = lazyWithRetry(() => import('./pages/Clients/ClientForm'));
const InventoryList = lazyWithRetry(() => import('./pages/Inventory/InventoryList'));
const InventoryForm = lazyWithRetry(() => import('./pages/Inventory/InventoryForm'));
const InventoryDetail = lazyWithRetry(() => import('./pages/Inventory/InventoryDetail'));
const InvoicesList = lazyWithRetry(() => import('./pages/Invoices/InvoicesList'));
const InvoiceForm = lazyWithRetry(() => import('./pages/Invoices/InvoiceForm'));
const InvoiceDetail = lazyWithRetry(() => import('./pages/Invoices/InvoiceDetail'));
const InvoicePreview = lazyWithRetry(() => import('./pages/Invoices/InvoicePreview'));
const Settings = lazyWithRetry(() => import('./pages/Settings/Settings'));
const ApiKeysList = lazyWithRetry(() => import('./pages/ApiKeys/ApiKeysList'));
const Feedback = lazyWithRetry(() => import('./pages/Feedback/Feedback'));
const InvoiceTemplatesList = lazyWithRetry(() => import('./pages/InvoiceTemplates/InvoiceTemplatesList'));
const InvoiceTemplateEditor = lazyWithRetry(() => import('./pages/InvoiceTemplates/InvoiceTemplateEditor'));
const StoreList = lazyWithRetry(() => import('./pages/Stores/StoreList'));
const StoreForm = lazyWithRetry(() => import('./pages/Stores/StoreForm'));
const StoreDetail = lazyWithRetry(() => import('./pages/Stores/StoreDetail'));
const StoreItemSettings = lazyWithRetry(() => import('./pages/Stores/StoreItemSettings'));
const StoreStockReport = lazyWithRetry(() => import('./pages/Stores/StoreStockReport'));
const StoreAnalytics = lazyWithRetry(() => import('./pages/Analytics/StoreAnalytics'));
const PlanSelection = lazyWithRetry(() => import('./pages/Subscription/PlanSelection'));
const Billing = lazyWithRetry(() => import('./pages/Subscription/Billing'));
const SubscriptionSuccess = lazyWithRetry(() => import('./pages/Subscription/Success'));
const SubscriptionCancel = lazyWithRetry(() => import('./pages/Subscription/Cancel'));
const NotFound = lazyWithRetry(() => import('./pages/NotFound'));

function App() {

  return (
    <ErrorBoundary>
      <Routes>
      <Route
        path="/login/*"
        element={
          <AuthRouteWrapper>
            <RoutePage><Login /></RoutePage>
          </AuthRouteWrapper>
        }
      />
      <Route
        path="/register/*"
        element={
          <AuthRouteWrapper>
            <RoutePage><Register /></RoutePage>
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
        <Route path="dashboard" element={<RoutePage><Dashboard /></RoutePage>} />
        <Route path="clients" element={<RoutePage><ClientsList /></RoutePage>} />
        <Route path="clients/create" element={<RoutePage><ClientForm /></RoutePage>} />
        <Route path="clients/:id" element={<RoutePage><ClientDetail /></RoutePage>} />
        <Route path="clients/:id/edit" element={<RoutePage><ClientForm /></RoutePage>} />
        <Route path="inventory" element={<RoutePage><InventoryList /></RoutePage>} />
        <Route path="inventory/create" element={<RoutePage><InventoryForm /></RoutePage>} />
        <Route path="inventory/:id" element={<RoutePage><InventoryDetail /></RoutePage>} />
        <Route path="inventory/:id/edit" element={<RoutePage><InventoryForm /></RoutePage>} />
        <Route path="invoices" element={<RoutePage><InvoicesList /></RoutePage>} />
        <Route path="invoices/create" element={<RoutePage><InvoiceForm /></RoutePage>} />
        <Route path="invoices/:id" element={<RoutePage><InvoiceDetail /></RoutePage>} />
        <Route path="invoices/:id/edit" element={<RoutePage><InvoiceForm /></RoutePage>} />
        <Route path="invoices/:id/preview" element={<RoutePage><InvoicePreview /></RoutePage>} />
        <Route path="settings" element={<RoutePage><Settings /></RoutePage>} />
        <Route path="subscription/plan" element={<RoutePage><PlanSelection /></RoutePage>} />
        <Route path="subscription/billing" element={<RoutePage><Billing /></RoutePage>} />
        <Route path="subscription/success" element={<RoutePage><SubscriptionSuccess /></RoutePage>} />
        <Route path="subscription/cancel" element={<RoutePage><SubscriptionCancel /></RoutePage>} />
        <Route path="api-keys" element={<RoutePage><ApiKeysList /></RoutePage>} />
        <Route path="feedback" element={<RoutePage><Feedback /></RoutePage>} />
        <Route path="invoice-templates" element={<RoutePage><InvoiceTemplatesList /></RoutePage>} />
        <Route path="invoice-templates/create" element={<RoutePage><InvoiceTemplateEditor /></RoutePage>} />
        <Route path="invoice-templates/:id" element={<RoutePage><InvoiceTemplateEditor /></RoutePage>} />
        <Route path="invoice-templates/:id/edit" element={<RoutePage><InvoiceTemplateEditor /></RoutePage>} />
        {/* Recurring invoices removed */}
        <Route path="stores" element={<RoutePage><StoreList /></RoutePage>} />
        <Route path="stores/new" element={<RoutePage><StoreForm /></RoutePage>} />
        <Route path="stores/:id" element={<RoutePage><StoreDetail /></RoutePage>} />
        <Route path="stores/:id/edit" element={<RoutePage><StoreForm /></RoutePage>} />
        <Route path="stores/:id/items" element={<RoutePage><StoreItemSettings /></RoutePage>} />
        <Route path="stores/:id/report" element={<RoutePage><StoreStockReport /></RoutePage>} />
        <Route path="analytics/stores" element={<RoutePage><StoreAnalytics /></RoutePage>} />
        <Route path="analytics/stores/:storeId" element={<RoutePage><StoreAnalytics /></RoutePage>} />
      </Route>
      <Route path="*" element={<RoutePage><NotFound /></RoutePage>} />
    </Routes>
    </ErrorBoundary>
  );
}

export default App;
