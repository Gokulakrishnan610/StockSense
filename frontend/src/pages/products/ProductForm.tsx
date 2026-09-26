import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check } from '../../components/ui/icons';
import { ErrorState } from '../../components/ui/ErrorState';
import { LoadingState } from '../../components/ui/LoadingState';
import { Select } from '../../components/ui/Select';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import type { ReorderRule } from '../../types';
import { InlineAlert } from '../operations/OperationComponents';
import { errorMessage, formatQty, quantityError, useCatalog } from '../operations/operationUtils';
import { COMMON_UNITS } from './productUtils';
import './products.css';

type FieldErrors = Partial<Record<'name' | 'sku' | 'category' | 'unit' | 'initialStock' | 'location' | 'minimum' | 'reorderQty', string>>;

export const ProductForm: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { isManager } = useAuth();
  const { showToast } = useToast();
  const { catalog, loading: catalogLoading, error: catalogError } = useCatalog();

  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [unit, setUnit] = useState('PCS');
  const [initialStock, setInitialStock] = useState('0');
  const [locationId, setLocationId] = useState('');
  const [minimum, setMinimum] = useState('');
  const [reorderQty, setReorderQty] = useState('');
  const [existingRule, setExistingRule] = useState<ReorderRule | null>(null);
  const [onHand, setOnHand] = useState<number | null>(null);

  const [loading, setLoading] = useState(isEdit);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    let active = true;
    Promise.all([api.getProduct(id), api.getReorderRules(id), api.getProductStock(id)])
      .then(([product, rules, stock]) => {
        if (!active) return;
        setName(product.name);
        setSku(product.sku);
        setCategoryId(product.category_id);
        setUnit(product.unit_of_measure);
        const rule = rules[0] ?? null;
        setExistingRule(rule);
        if (rule) {
          setMinimum(String(Number(rule.minimum_stock)));
          setReorderQty(String(Number(rule.reorder_quantity)));
        }
        setOnHand(stock.reduce((sum, row) => sum + Number(row.quantity), 0));
      })
      .catch((err) => active && setLoadError(errorMessage(err, 'Failed to load product')))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [id]);

  if (!isManager) {
    return (
      <ErrorState
        title="Manager access required"
        message="Only inventory managers can create or edit products."
      />
    );
  }
  if (loading || catalogLoading) return <LoadingState message="Loading form..." height="300px" />;
  if (loadError) return <ErrorState message={loadError} />;
  if (catalogError) return <ErrorState message={catalogError} />;

  const backTo = id ? `/products/${id}` : '/products';
  const locationOptions = catalog.warehouses.map((w) => ({
    label: `${w.name} (${w.short_code})`,
    options: catalog.locations
      .filter((l) => l.warehouse_id === w.id)
      .map((l) => ({ value: l.id, label: `${w.name} / ${l.name}` })),
  }));

  const validate = (): FieldErrors => {
    const errors: FieldErrors = {};
    if (!name.trim()) errors.name = 'Product name is required.';
    if (!sku.trim()) errors.sku = 'SKU is required.';
    else if (!/^[A-Za-z0-9_.-]+$/.test(sku.trim())) errors.sku = 'Use letters, numbers, dot, dash or underscore.';
    if (!categoryId) errors.category = 'Select a category.';
    if (!unit.trim()) errors.unit = 'Unit of measure is required.';
    if (!isEdit) {
      const stockError = quantityError(initialStock || '0', true);
      if (stockError) errors.initialStock = stockError;
      else if (Number(initialStock) > 0 && !locationId) errors.location = 'Choose where the opening stock is stored.';
    }
    const hasRule = minimum.trim() !== '' || reorderQty.trim() !== '';
    if (hasRule) {
      const minError = quantityError(minimum, true);
      const qtyError = quantityError(reorderQty);
      if (minError) errors.minimum = minError;
      if (qtyError) errors.reorderQty = qtyError;
    }
    return errors;
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length) {
      setFormError('Please fix the highlighted fields.');
      return;
    }
    setFormError(null);
    setSaving(true);
    let productId = id;
    try {
      const base = {
        name: name.trim(),
        sku: sku.trim().toUpperCase(),
        category_id: categoryId,
        unit_of_measure: unit.trim().toUpperCase(),
      };
      if (productId) {
        await api.updateProduct(productId, base);
      } else {
        const created = await api.createProduct({
          ...base,
          initial_stock: initialStock || '0',
          initial_location_id: Number(initialStock) > 0 ? locationId : undefined,
        });
        productId = created.id;
      }

      if (minimum.trim() !== '' && reorderQty.trim() !== '') {
        const rule = { product_id: productId, minimum_stock: minimum.trim(), reorder_quantity: reorderQty.trim() };
        if (existingRule) await api.updateReorderRule(existingRule.id, rule);
        else await api.createReorderRule(rule);
      }

      showToast('success', isEdit ? 'Product updated' : 'Product created', `${base.name} (${base.sku}) saved.`);
      navigate(`/products/${productId}`);
    } catch (err) {
      const e = err as { errors?: Array<{ field: string; message: string }> };
      const message = errorMessage(err, 'Failed to save product');
      if (productId && !isEdit) {
        // The product exists; the reorder rule failed. Continue on the product page.
        showToast('error', 'Reorder rule not saved', message);
        navigate(`/products/${productId}`);
        return;
      }
      if (e.errors?.some((item) => item.field.endsWith('sku'))) setFieldErrors({ sku: 'Check the SKU format.' });
      setFormError(message);
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (key: keyof FieldErrors) =>
    fieldErrors[key] ? <span className="form-error">{fieldErrors[key]}</span> : null;

  return (
    <div className="product-form-page">
      <div className="product-form-header">
        <button className="icon-button" onClick={() => navigate(backTo)} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <div style={{ flex: 1 }}>
          <h2 className="page-title">{isEdit ? `Edit Product: ${sku}` : 'New Product'}</h2>
          <p className="page-subtitle">
            {isEdit
              ? 'Update the product details and its reorder rule.'
              : 'Define the SKU, category, unit, opening stock and reorder rule.'}
          </p>
        </div>
      </div>

      <form className="card product-form" onSubmit={save} noValidate>
        {formError && <InlineAlert>{formError}</InlineAlert>}

        <h3 className="form-section-title">General Information</h3>
        <div className="form-group">
          <label className="form-label" htmlFor="pf-name">Product Name *</label>
          <input
            id="pf-name"
            className="form-input"
            value={name}
            maxLength={160}
            placeholder="e.g. Steel Rod 12 mm"
            onChange={(e) => setName(e.target.value)}
            disabled={saving}
            autoFocus
          />
          {fieldError('name')}
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="pf-sku">Stock Keeping Unit (SKU) *</label>
            <input
              id="pf-sku"
              className="form-input mono-input"
              value={sku}
              maxLength={64}
              placeholder="e.g. STEEL-ROD-12"
              onChange={(e) => setSku(e.target.value.toUpperCase())}
              disabled={saving}
            />
            {fieldError('sku') ?? <span className="form-hint">Unique product code, stored in upper case</span>}
          </div>
          <div className="form-group">
            <label className="form-label">Category *</label>
            <Select
              variant="form"
              value={categoryId}
              onChange={setCategoryId}
              options={catalog.categories.map((c) => ({ value: c.id, label: c.name }))}
              placeholder={catalog.categories.length ? 'Select category' : 'Create a category first'}
              disabled={saving}
              aria-label="Category"
            />
            {fieldError('category')}
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="pf-unit">Unit of Measure *</label>
            <input
              id="pf-unit"
              className="form-input"
              list="pf-units"
              value={unit}
              maxLength={32}
              onChange={(e) => setUnit(e.target.value.toUpperCase())}
              disabled={saving}
            />
            <datalist id="pf-units">
              {COMMON_UNITS.map((u) => <option key={u} value={u} />)}
            </datalist>
            {fieldError('unit') ??
              (isEdit ? (
                <span className="form-hint">Cannot change once the product has stock movements</span>
              ) : (
                <span className="form-hint">Pick a common unit or type your own</span>
              ))}
          </div>
        </div>

        {isEdit ? (
          <>
            <h3 className="form-section-title">Current Stock Summary</h3>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Current On-Hand Balance</label>
                <input className="form-input" value={formatQty(onHand ?? 0, unit)} readOnly disabled />
                <span className="form-hint">Stock changes are recorded through operations (receipts, deliveries, transfers, adjustments)</span>
              </div>
            </div>
          </>
        ) : (
          <>
            <h3 className="form-section-title">Initial Stock Placement</h3>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="pf-initial">Opening Stock Quantity</label>
                <input
                  id="pf-initial"
                  className="form-input"
                  inputMode="decimal"
                  value={initialStock}
                  onChange={(e) => setInitialStock(e.target.value)}
                  disabled={saving}
                />
                {fieldError('initialStock') ?? <span className="form-hint">Leave 0 to receive stock later</span>}
              </div>
              <div className="form-group">
                <label className="form-label">Initial Location {Number(initialStock) > 0 && '*'}</label>
                <Select
                  variant="form"
                  value={locationId}
                  onChange={setLocationId}
                  options={locationOptions}
                  placeholder="Select location"
                  disabled={saving || !(Number(initialStock) > 0)}
                  aria-label="Initial location"
                />
                {fieldError('location')}
              </div>
            </div>
          </>
        )}

        <h3 className="form-section-title">Replenishment (Optional)</h3>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label" htmlFor="pf-min">Minimum Stock</label>
            <input
              id="pf-min"
              className="form-input"
              inputMode="decimal"
              placeholder="e.g. 25"
              value={minimum}
              onChange={(e) => setMinimum(e.target.value)}
              disabled={saving}
            />
            {fieldError('minimum') ?? <span className="form-hint">A low-stock alert is raised at or below this level</span>}
          </div>
          <div className="form-group">
            <label className="form-label" htmlFor="pf-reorder">Reorder Quantity</label>
            <input
              id="pf-reorder"
              className="form-input"
              inputMode="decimal"
              placeholder="e.g. 50"
              value={reorderQty}
              onChange={(e) => setReorderQty(e.target.value)}
              disabled={saving}
            />
            {fieldError('reorderQty') ?? <span className="form-hint">Suggested quantity when receiving stock</span>}
          </div>
        </div>
        {existingRule && (minimum.trim() === '' || reorderQty.trim() === '') && (
          <p className="form-hint" style={{ marginTop: -8 }}>
            Both values are needed to update the existing rule; leave them filled to keep it.
          </p>
        )}

        <div className="product-form-footer">
          <span className="form-hint">* Required fields</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate(backTo)} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              <Check size={16} /> {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};
