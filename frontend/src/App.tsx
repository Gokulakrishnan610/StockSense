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
import { LocationList } from './pages/locations/LocationList';
import { ReorderRuleList } from './pages/reordering/ReorderRuleList';
import { Profile } from './pages/Profile';

// Operations Stubs for Member 4
import { ReceiptsStub } from './pages/operations/ReceiptsStub';
import { DeliveryOrdersStub } from './pages/operations/DeliveryOrdersStub';
import { InventoryAdjustmentsStub } from './pages/operations/InventoryAdjustmentsStub';
import { MoveHistoryStub } from './pages/operations/MoveHistoryStub';

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
              <Route path="locations" element={<LocationList />} />
              <Route path="reordering-rules" element={<ReorderRuleList />} />
              <Route path="profile" element={<Profile />} />

              {/* Member 4 Operations Navigation */}
              <Route path="operations/receipts" element={<ReceiptsStub />} />
              <Route path="operations/deliveries" element={<DeliveryOrdersStub />} />
              <Route path="operations/adjustments" element={<InventoryAdjustmentsStub />} />
              <Route path="operations/move-history" element={<MoveHistoryStub />} />
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
