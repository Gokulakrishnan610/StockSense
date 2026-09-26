import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Eye, Edit3 } from 'lucide-react';
import { api } from '../../services/api';
import type { Product, Category, Warehouse, Location } from '../../types';
import { useAuth } from '../../context/AuthContext';
import { SearchInput } from '../../components/ui/SearchInput';
import { FilterDropdown } from '../../components/ui/FilterDropdown';
import { DataTable, type Column } from '../../components/ui/DataTable';
import { ErrorState } from '../../components/ui/ErrorState';
import { ProductModal } from './ProductModal';
import { ProductDetailModal } from './ProductDetailModal';

export const ProductList: React.FC = () => {
  const { isManager } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');

  const [offset, setOffset] = useState(0);
  const limit = 20;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodsRes, catsRes, whsRes, locsRes] = await Promise.all([
        api.getProducts({
          search: search || undefined,
          category_id: selectedCategory || undefined,
          warehouse_id: selectedWarehouse || undefined,
          location_id: selectedLocation || undefined,
          offset,
          limit,
        }),
        api.getCategories(),
        api.getWarehouses(),
        api.getLocations(selectedWarehouse || undefined),
      ]);

      setProducts(prodsRes);
      setCategories(catsRes);
      setWarehouses(whsRes);
      setLocations(locsRes);
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(e.message || 'Failed to load product catalog');
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, selectedWarehouse, selectedLocation, offset]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Update locations list when warehouse filter changes
  useEffect(() => {
    if (selectedWarehouse) {
      api.getLocations(selectedWarehouse).then(setLocations).catch(() => {});
    }
  }, [selectedWarehouse]);

  const columns: Column<Product>[] = [
    {
      key: 'sku',
      header: 'SKU / Code',
      render: (p) => (
        <span style={{ fontWeight: 700, color: 'var(--color-primary)' }}>{p.sku}</span>
      ),
    },
    {
      key: 'name',
      header: 'Product Name',
      render: (p) => <span style={{ fontWeight: 500 }}>{p.name}</span>,
    },
    {
      key: 'category_id',
      header: 'Category',
      render: (p) => {
        const cat = categories.find((c) => c.id === p.category_id);
        return <span style={{ color: 'var(--text-muted)' }}>{cat?.name || '—'}</span>;
      },
    },
    {
      key: 'unit_of_measure',
      header: 'Unit of Measure',
      render: (p) => <span style={{ color: 'var(--text-muted)' }}>{p.unit_of_measure}</span>,
    },
    {
      key: 'initial_stock',
      header: 'Opening Stock',
      align: 'right',
      render: (p) => (
        <span style={{ fontWeight: 600 }}>{parseFloat(p.initial_stock || '0').toFixed(2)}</span>
      ),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (p) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' }}>
          <button
            onClick={() => {
              setViewingProduct(p);
              setIsDetailModalOpen(true);
            }}
            className="btn btn-secondary btn-sm"
            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
            title="View Stock Availability"
          >
            <Eye size={14} /> Stock
          </button>
          {isManager && (
            <button
              onClick={() => {
                setEditingProduct(p);
                setIsProductModalOpen(true);
              }}
              className="btn btn-secondary btn-sm"
              style={{ padding: '4px 8px', fontSize: '0.75rem' }}
              title="Edit Product"
            >
              <Edit3 size={14} /> Edit
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">Products Management</h2>
          <p className="page-subtitle">Maintain catalog records, SKUs, and location stock</p>
        </div>
        {isManager && (
          <button
            onClick={() => {
              setEditingProduct(null);
              setIsProductModalOpen(true);
            }}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <Plus size={18} /> Add Product
          </button>
        )}
      </div>

      {/* Toolbar & Filters */}
      <div
        className="card"
        style={{
          marginBottom: '20px',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
        }}
      >
        <SearchInput
          value={search}
          onChange={(val) => {
            setSearch(val);
            setOffset(0);
          }}
          placeholder="Search product name or SKU..."
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          <FilterDropdown
            label="Category"
            value={selectedCategory}
            onChange={(val) => {
              setSelectedCategory(val);
              setOffset(0);
            }}
            allLabel="All Categories"
            options={categories.map((c) => ({ value: c.id, label: c.name }))}
          />

          <FilterDropdown
            label="Warehouse"
            value={selectedWarehouse}
            onChange={(val) => {
              setSelectedWarehouse(val);
              setSelectedLocation('');
              setOffset(0);
            }}
            allLabel="All Warehouses"
            options={warehouses.map((w) => ({ value: w.id, label: `${w.name} (${w.short_code})` }))}
          />

          <FilterDropdown
            label="Location"
            value={selectedLocation}
            onChange={(val) => {
              setSelectedLocation(val);
              setOffset(0);
            }}
            allLabel="All Locations"
            options={locations.map((l) => ({ value: l.id, label: `${l.name} (${l.short_code})` }))}
            disabled={!selectedWarehouse && locations.length === 0}
          />
        </div>
      </div>

      {/* Content Table */}
      {error ? (
        <ErrorState message={error} onRetry={loadData} />
      ) : (
        <DataTable
          columns={columns}
          data={products}
          keyExtractor={(p) => p.id}
          loading={loading}
          emptyTitle="No products found"
          emptyDescription="Try clearing your search query or creating a new product record."
          emptyActionLabel={isManager ? 'Create Product' : undefined}
          onEmptyAction={
            isManager
              ? () => {
                  setEditingProduct(null);
                  setIsProductModalOpen(true);
                }
              : undefined
          }
          pagination={{
            offset,
            limit,
            hasMore: products.length === limit,
            onPageChange: setOffset,
          }}
        />
      )}

      {/* Product Create / Edit Modal */}
      <ProductModal
        isOpen={isProductModalOpen}
        onClose={() => setIsProductModalOpen(false)}
        onSuccess={loadData}
        product={editingProduct}
        categories={categories}
        locations={locations}
      />

      {/* Product Detail Modal */}
      <ProductDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        product={viewingProduct}
      />
    </div>
  );
};
