import React, { useState, useEffect } from 'react';
import { Modal } from '../../components/ui/Modal';
import type { Product, Category, Location, ProductCreateInput, ProductInput } from '../../types';
import { api } from '../../services/api';
import { useToast } from '../../context/ToastContext';
import { AlertCircle } from '../../components/ui/icons';
import { Select } from '../../components/ui/Select';

interface ProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: Product | null;
  categories: Category[];
  locations: Location[];
}

export const ProductModal: React.FC<ProductModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  product,
  categories,
  locations,
}) => {
  const isEditing = Boolean(product);

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unitOfMeasure, setUnitOfMeasure] = useState('PCS');
  const [initialStock, setInitialStock] = useState('0');
  const [initialLocationId, setInitialLocationId] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const { showToast } = useToast();

  useEffect(() => {
    if (product) {
      setName(product.name);
      setSku(product.sku);
      setCategoryId(product.category_id);
      setUnitOfMeasure(product.unit_of_measure);
      setInitialStock(product.initial_stock || '0');
      setInitialLocationId('');
    } else {
      setName('');
      setSku('');
      setCategoryId(categories.length > 0 ? categories[0].id : '');
      setUnitOfMeasure('PCS');
      setInitialStock('0');
      setInitialLocationId(locations.length > 0 ? locations[0].id : '');
    }
    setErrorMessage('');
    setFieldErrors({});
  }, [product, isOpen, categories, locations]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    if (!name.trim()) errors.name = 'Product name is required.';
    if (!sku.trim()) errors.sku = 'SKU / Code is required.';
    if (!categoryId) errors.categoryId = 'Category selection is required.';
    if (!unitOfMeasure.trim()) errors.unitOfMeasure = 'Unit of measure is required.';

    if (!isEditing) {
      const stockVal = parseFloat(initialStock);
      if (isNaN(stockVal) || stockVal < 0) {
        errors.initialStock = 'Initial stock cannot be negative.';
      }
      if (stockVal > 0 && !initialLocationId) {
        errors.initialLocationId = 'Initial location is required for positive stock.';
      }
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setErrorMessage('');

    try {
      if (isEditing && product) {
        const updatePayload: ProductInput = {
          name: name.trim(),
          sku: sku.trim().toUpperCase(),
          category_id: categoryId,
          unit_of_measure: unitOfMeasure.trim(),
        };
        await api.updateProduct(product.id, updatePayload);
        showToast('success', 'Product Updated', `Product ${name} has been updated.`);
      } else {
        const createPayload: ProductCreateInput = {
          name: name.trim(),
          sku: sku.trim().toUpperCase(),
          category_id: categoryId,
          unit_of_measure: unitOfMeasure.trim(),
          initial_stock: initialStock,
          initial_location_id: initialLocationId || undefined,
        };
        await api.createProduct(createPayload);
        showToast('success', 'Product Created', `Product ${name} has been added to catalog.`);
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const error = err as { message?: string; errors?: Array<{ field: string; message: string }> };
      if (error.errors && error.errors.length > 0) {
        const backendFieldErrors: Record<string, string> = {};
        error.errors.forEach((e) => {
          backendFieldErrors[e.field] = e.message;
        });
        setFieldErrors(backendFieldErrors);
      }
      setErrorMessage(error.message || 'Failed to save product record.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditing ? 'Edit Product' : 'Add New Product'}
      maxWidth="560px"
      footer={
        <>
          <button onClick={onClose} className="btn btn-secondary" disabled={submitting}>
            Cancel
          </button>
          <button onClick={handleSubmit} className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Saving...' : isEditing ? 'Update Product' : 'Create Product'}
          </button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {errorMessage && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px 12px',
              borderRadius: '8px',
              backgroundColor: 'var(--surface-danger-subtle)',
              border: '1px solid var(--border-danger)',
              color: 'var(--color-danger)',
              fontSize: '0.8438rem',
              marginBottom: '16px',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Product Name *</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. Industrial Steel Rods 50mm"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            autoFocus
          />
          {fieldErrors.name && <div className="form-error">{fieldErrors.name}</div>}
        </div>

        <div className="form-group">
          <label className="form-label">SKU / Code *</label>
          <input
            type="text"
            className="form-input"
            placeholder="e.g. STEEL-50MM-001"
            value={sku}
            onChange={(e) => setSku(e.target.value.toUpperCase())}
            disabled={submitting}
          />
          {fieldErrors.sku && <div className="form-error">{fieldErrors.sku}</div>}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label">Category *</label>
            <Select
              value={categoryId}
              onChange={setCategoryId}
              options={categories.map((cat) => ({ value: cat.id, label: cat.name }))}
              placeholder="Select category"
              disabled={submitting}
            />
            {fieldErrors.categoryId && <div className="form-error">{fieldErrors.categoryId}</div>}
          </div>

          <div className="form-group">
            <label className="form-label">Unit of Measure *</label>
            <input
              type="text"
              className="form-input"
              placeholder="e.g. KG, PCS, BOX"
              value={unitOfMeasure}
              onChange={(e) => setUnitOfMeasure(e.target.value)}
              disabled={submitting}
            />
            {fieldErrors.unitOfMeasure && <div className="form-error">{fieldErrors.unitOfMeasure}</div>}
          </div>
        </div>

        {!isEditing && (
          <div
            style={{
              padding: '16px',
              backgroundColor: 'var(--surface-input)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              marginTop: '8px',
            }}
          >
            <h5 style={{ margin: '0 0 12px 0', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              Opening Stock (Optional)
            </h5>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Initial Quantity</label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  className="form-input"
                  value={initialStock}
                  onChange={(e) => setInitialStock(e.target.value)}
                  disabled={submitting}
                />
                {fieldErrors.initialStock && <div className="form-error">{fieldErrors.initialStock}</div>}
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label className="form-label">Initial Storage Location</label>
                <Select
                  value={initialLocationId}
                  onChange={setInitialLocationId}
                  options={locations.map((loc) => ({ value: loc.id, label: `${loc.name} (${loc.short_code})` }))}
                  placeholder="Select location"
                  disabled={submitting || parseFloat(initialStock) <= 0}
                />
                {fieldErrors.initialLocationId && (
                  <div className="form-error">{fieldErrors.initialLocationId}</div>
                )}
              </div>
            </div>
          </div>
        )}
      </form>
    </Modal>
  );
};
