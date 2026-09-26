import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { ProtectedRoute } from './components/ProtectedRoute';

// Layouts
import { AppLayout } from './layouts/AppLayout';

// Auth Pages
import { Login } from './pages/auth/Login';
import { Signup } from './pages/auth/Signup';
import { ForgotPassword } from './pages/auth/ForgotPassword';
import { VerifyOTP } from './pages/auth/VerifyOTP';
import { ResetPassword } from './pages/auth/ResetPassword';

// Core Pages
import { Dashboard } from './pages/Dashboard';
import { ProductList } from './pages/products/ProductList';
import { CategoryList } from './pages/categories/CategoryList';
import { WarehouseList } from './pages/warehouses/WarehouseList';
import { WarehouseDetail } from './pages/warehouses/WarehouseDetail';
import { LocationList } from './pages/locations/LocationList';
import { ReorderRuleList } from './pages/reordering/ReorderRuleList';
import { Profile } from './pages/Profile';

// Operations & Stock Ledger (Member 4)
import {
  AdjustmentList,
  DeliveryList,
  ReceiptList,
  TransferList,
} from './pages/operations/OperationPages';
import { OperationForm } from './pages/operations/OperationForm';
import { OperationDetail } from './pages/operations/OperationDetail';
import { AdjustmentForm } from './pages/operations/AdjustmentForm';
import { AdjustmentDetail } from './pages/operations/AdjustmentDetail';
import { MoveHistory } from './pages/operations/MoveHistory';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/verify-otp" element={<VerifyOTP />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* Protected App Routes */}
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
              <Route path="products" element={<ProductList />} />
              <Route path="categories" element={<CategoryList />} />
              <Route path="warehouses" element={<WarehouseList />} />
              <Route path="warehouses/:id" element={<WarehouseDetail />} />
              <Route path="locations" element={<LocationList />} />
              <Route path="reordering-rules" element={<ReorderRuleList />} />
              <Route path="profile" element={<Profile />} />

              {/* Operations & Stock Ledger (Member 4) */}
              <Route path="operations/receipts" element={<ReceiptList />} />
              <Route path="operations/receipts/new" element={<OperationForm key="receipt-new" kind="receipt" />} />
              <Route path="operations/receipts/:id" element={<OperationDetail kind="receipt" />} />
              <Route path="operations/receipts/:id/edit" element={<OperationForm key="receipt-edit" kind="receipt" />} />
              <Route path="operations/deliveries" element={<DeliveryList />} />
              <Route path="operations/deliveries/new" element={<OperationForm key="delivery-new" kind="delivery" />} />
              <Route path="operations/deliveries/:id" element={<OperationDetail kind="delivery" />} />
              <Route path="operations/deliveries/:id/edit" element={<OperationForm key="delivery-edit" kind="delivery" />} />
              <Route path="operations/transfers" element={<TransferList />} />
              <Route path="operations/transfers/new" element={<OperationForm key="transfer-new" kind="transfer" />} />
              <Route path="operations/transfers/:id" element={<OperationDetail kind="transfer" />} />
              <Route path="operations/transfers/:id/edit" element={<OperationForm key="transfer-edit" kind="transfer" />} />
              <Route path="operations/adjustments" element={<AdjustmentList />} />
              <Route path="operations/adjustments/new" element={<AdjustmentForm />} />
              <Route path="operations/adjustments/:id" element={<AdjustmentDetail />} />
              <Route path="operations/move-history" element={<MoveHistory />} />
            </Route>

            {/* Fallback Catch-all */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;
