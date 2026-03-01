'use client';
// components/dialogs/product-form.tsx
// ✅ Custom category typing (not just a fixed list)
// ✅ Unit of measure: item / kg / g / bag / litre / ml / pack / box / dozen / carton
// ✅ unit_of_measure saved to DB — add column: ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_of_measure TEXT DEFAULT 'item';
// ✅ barcode field included
// ✅ Clean, polished UI

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, Package, Tag, DollarSign, Boxes, Barcode, ChevronDown, Check } from 'lucide-react';

interface ProductFormProps {
  onClose: () => void;
  onSubmit: (product: any) => void;
  initialProduct?: any;
}

const PRESET_CATEGORIES = [
  'Groceries', 'Beverages', 'Dairy', 'Bakery', 'Snacks',
  'Toiletries', 'Household', 'Personal Care', 'Produce', 'Meat & Seafood',
  'Frozen Foods', 'Condiments', 'Stationery', 'Electronics',
];

const UNITS = [
  { value: 'item',   label: 'Item',    desc: 'Single unit' },
  { value: 'kg',     label: 'kg',      desc: 'Kilogram' },
  { value: 'g',      label: 'g',       desc: 'Gram' },
  { value: 'bag',    label: 'Bag',     desc: 'Per bag' },
  { value: 'litre',  label: 'Litre',   desc: 'Per litre' },
  { value: 'ml',     label: 'ml',      desc: 'Millilitre' },
  { value: 'pack',   label: 'Pack',    desc: 'Per pack' },
  { value: 'box',    label: 'Box',     desc: 'Per box' },
  { value: 'dozen',  label: 'Dozen',   desc: '12 units' },
  { value: 'carton', label: 'Carton',  desc: 'Per carton' },
  { value: 'bunch',  label: 'Bunch',   desc: 'Per bunch' },
  { value: 'roll',   label: 'Roll',    desc: 'Per roll' },
];

// ✅ Defined OUTSIDE component — if inside, React remounts it on every keystroke (loses focus)
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function ProductForm({ onClose, onSubmit, initialProduct }: ProductFormProps) {
  // ✅ categoryInput is the SINGLE source of truth for category — formData.category mirrors it
  const [categoryInput, setCategoryInput] = useState(initialProduct?.category ?? '');

  const [formData, setFormData] = useState({
    name:              initialProduct?.name              ?? '',
    sku:               initialProduct?.sku               ?? '',
    category:          initialProduct?.category          ?? '', // kept in sync with categoryInput
    price:             initialProduct?.price             ?? '',
    cost:              initialProduct?.cost              ?? '',
    stock:             initialProduct?.stock             ?? '',
    lowStockThreshold: initialProduct?.lowStockThreshold ?? '',
    barcode:           initialProduct?.barcode           ?? '',
    unitOfMeasure:     initialProduct?.unitOfMeasure     ?? 'item',
  });
  const [showCategoryDrop, setShowCategoryDrop] = useState(false);
  const [showUnitDrop, setShowUnitDrop]         = useState(false);
  const catRef  = useRef<HTMLDivElement>(null);
  const unitRef = useRef<HTMLDivElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (catRef.current  && !catRef.current.contains(e.target as Node))  setShowCategoryDrop(false);
      if (unitRef.current && !unitRef.current.contains(e.target as Node)) setShowUnitDrop(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filteredCategories = PRESET_CATEGORIES.filter(c =>
    c.toLowerCase().includes(categoryInput.toLowerCase())
  );

  const selectCategory = (cat: string) => {
    setCategoryInput(cat);
    setFormData(p => ({ ...p, category: cat }));
    setShowCategoryDrop(false);
  };

  const selectedUnit = UNITS.find(u => u.value === formData.unitOfMeasure) ?? UNITS[0];

  const profit = formData.price && formData.cost
    ? (Number(formData.price) - Number(formData.cost)).toFixed(2)
    : null;
  const margin = formData.price && formData.cost && Number(formData.price) > 0
    ? (((Number(formData.price) - Number(formData.cost)) / Number(formData.price)) * 100).toFixed(1)
    : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // ✅ categoryInput is always the live value — typed or picked from dropdown
    const finalCategory = categoryInput.trim();
    if (!finalCategory) { alert('Please enter or select a category.'); return; }
    // Merge into formData so inventory page receives .category correctly
    onSubmit({ ...formData, category: finalCategory });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="w-full max-w-2xl bg-background rounded-2xl shadow-2xl border border-border overflow-hidden max-h-[95vh] flex flex-col">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-border bg-muted/30">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Package className="w-4.5 h-4.5 text-primary w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">
                {initialProduct ? 'Edit Product' : 'New Product'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {initialProduct ? `Editing: ${initialProduct.name}` : 'Fill in product details below'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Form Body ── */}
        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1">
          <div className="px-6 py-5 space-y-6">

            {/* Section: Identity */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
                <Tag className="w-3.5 h-3.5" /> Product Identity
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Field label="Product Name *">
                    <Input
                      value={formData.name}
                      onChange={e => setFormData(p => ({ ...p, name: e.target.value }))}
                      placeholder="e.g. Unga Pembe Flour"
                      required
                      className="h-10"
                    />
                  </Field>
                </div>

                <Field label="SKU *">
                  <Input
                    value={formData.sku}
                    onChange={e => setFormData(p => ({ ...p, sku: e.target.value }))}
                    placeholder="e.g. SKU-001"
                    required
                    className="h-10 font-mono text-sm"
                  />
                </Field>

                <Field label="Barcode" hint="Scan or type manually">
                  <div className="relative">
                    <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      value={formData.barcode}
                      onChange={e => setFormData(p => ({ ...p, barcode: e.target.value }))}
                      placeholder="Optional"
                      className="pl-9 h-10 font-mono text-sm"
                    />
                  </div>
                </Field>

                {/* Category — type or pick */}
                <div className="col-span-2" ref={catRef}>
                  <Field label="Category *" hint="Type to create a new category or pick from the list">
                    <div className="relative">
                      <Input
                        value={categoryInput}
                        onChange={e => {
                          const val = e.target.value;
                          setCategoryInput(val);
                          setFormData(p => ({ ...p, category: val })); // ✅ always in sync
                          setShowCategoryDrop(true);
                        }}
                        onFocus={() => setShowCategoryDrop(true)}
                        placeholder="Type or choose a category..."
                        className="h-10 pr-9"
                      />
                      <button
                        type="button"
                        tabIndex={-1}
                        onClick={() => setShowCategoryDrop(v => !v)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        <ChevronDown className={`w-4 h-4 transition-transform ${showCategoryDrop ? 'rotate-180' : ''}`} />
                      </button>

                      {showCategoryDrop && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-20 max-h-44 overflow-y-auto">
                          {/* Custom entry option */}
                          {categoryInput && !PRESET_CATEGORIES.some(c => c.toLowerCase() === categoryInput.toLowerCase()) && (
                            <button
                              type="button"
                              onClick={() => selectCategory(categoryInput.trim())}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center gap-2 border-b border-border text-primary font-medium"
                            >
                              <span className="w-4 h-4 rounded bg-primary/20 flex items-center justify-center text-xs font-bold">+</span>
                              Create "{categoryInput.trim()}"
                            </button>
                          )}
                          {filteredCategories.length > 0 ? filteredCategories.map(cat => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => selectCategory(cat)}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-muted flex items-center justify-between"
                            >
                              {cat}
                              {formData.category === cat && <Check className="w-3.5 h-3.5 text-primary" />}
                            </button>
                          )) : (
                            !categoryInput && (
                              <p className="px-3 py-2 text-xs text-muted-foreground">Type to search or create…</p>
                            )
                          )}
                        </div>
                      )}
                    </div>
                  </Field>
                </div>

                {/* Unit of Measure */}
                <div className="col-span-2" ref={unitRef}>
                  <Field label="Unit of Measure *" hint="How is this product sold or measured?">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowUnitDrop(v => !v)}
                        className="w-full h-10 px-3 border border-input rounded-md bg-background text-sm flex items-center justify-between hover:border-primary/50 transition-colors"
                      >
                        <span className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">{selectedUnit.label}</span>
                          <span className="text-muted-foreground text-xs">— {selectedUnit.desc}</span>
                        </span>
                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${showUnitDrop ? 'rotate-180' : ''}`} />
                      </button>

                      {showUnitDrop && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg z-20">
                          <div className="grid grid-cols-3 gap-1 p-2">
                            {UNITS.map(unit => (
                              <button
                                key={unit.value}
                                type="button"
                                onClick={() => {
                                  setFormData(p => ({ ...p, unitOfMeasure: unit.value }));
                                  setShowUnitDrop(false);
                                }}
                                className={`text-left px-3 py-2 rounded-lg text-sm transition-colors flex flex-col ${
                                  formData.unitOfMeasure === unit.value
                                    ? 'bg-primary text-primary-foreground'
                                    : 'hover:bg-muted text-foreground'
                                }`}
                              >
                                <span className="font-semibold">{unit.label}</span>
                                <span className={`text-xs ${formData.unitOfMeasure === unit.value ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                                  {unit.desc}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </Field>
                </div>
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-border" />

            {/* Section: Pricing */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5" /> Pricing
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Field label={`Selling Price (per ${selectedUnit.label}) *`}>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">KSH</span>
                    <Input
                      type="number" step="0.01" min="0"
                      value={formData.price}
                      onChange={e => setFormData(p => ({ ...p, price: e.target.value }))}
                      placeholder="0.00"
                      className="pl-12 h-10"
                      required
                    />
                  </div>
                </Field>

                <Field label={`Cost Price (per ${selectedUnit.label}) *`}>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">KSH</span>
                    <Input
                      type="number" step="0.01" min="0"
                      value={formData.cost}
                      onChange={e => setFormData(p => ({ ...p, cost: e.target.value }))}
                      placeholder="0.00"
                      className="pl-12 h-10"
                      required
                    />
                  </div>
                </Field>
              </div>

              {/* Live profit preview */}
              {profit !== null && (
                <div className={`mt-3 px-4 py-2.5 rounded-lg flex items-center justify-between text-sm ${
                  Number(profit) >= 0 ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
                }`}>
                  <span className="text-muted-foreground font-medium">Profit per {selectedUnit.label}</span>
                  <div className="flex items-center gap-3">
                    <span className={`font-bold ${Number(profit) >= 0 ? 'text-green-700' : 'text-red-600'}`}>
                      KSH {profit}
                    </span>
                    {margin && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                        Number(profit) >= 0 ? 'bg-green-200 text-green-800' : 'bg-red-200 text-red-800'
                      }`}>
                        {margin}% margin
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Divider */}
            <div className="border-t border-dashed border-border" />

            {/* Section: Stock */}
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3 flex items-center gap-2">
                <Boxes className="w-3.5 h-3.5" /> Stock Levels
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Field label={`Current Stock (${selectedUnit.label}s) *`}>
                  <Input
                    type="number" min="0"
                    value={formData.stock}
                    onChange={e => setFormData(p => ({ ...p, stock: e.target.value }))}
                    placeholder="0"
                    className="h-10"
                    required
                  />
                </Field>

                <Field label="Low Stock Alert Threshold *" hint="Alert when stock falls below this">
                  <Input
                    type="number" min="0"
                    value={formData.lowStockThreshold}
                    onChange={e => setFormData(p => ({ ...p, lowStockThreshold: e.target.value }))}
                    placeholder="e.g. 10"
                    className="h-10"
                    required
                  />
                </Field>
              </div>

              {/* Stock status preview */}
              {formData.stock !== '' && formData.lowStockThreshold !== '' && (
                <div className={`mt-3 px-4 py-2.5 rounded-lg text-sm flex items-center gap-2 ${
                  Number(formData.stock) === 0
                    ? 'bg-red-50 border border-red-200 text-red-700'
                    : Number(formData.stock) <= Number(formData.lowStockThreshold)
                    ? 'bg-yellow-50 border border-yellow-200 text-yellow-700'
                    : 'bg-green-50 border border-green-200 text-green-700'
                }`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    Number(formData.stock) === 0 ? 'bg-red-500' :
                    Number(formData.stock) <= Number(formData.lowStockThreshold) ? 'bg-yellow-500' : 'bg-green-500'
                  }`} />
                  {Number(formData.stock) === 0
                    ? 'Out of stock — will not appear in POS'
                    : Number(formData.stock) <= Number(formData.lowStockThreshold)
                    ? `Low stock warning will trigger (${formData.stock} ${selectedUnit.label}s ≤ threshold of ${formData.lowStockThreshold})`
                    : `Healthy stock — ${formData.stock} ${selectedUnit.label}s available`}
                </div>
              )}
            </div>
          </div>

          {/* ── Footer ── */}
          <div className="px-6 py-4 border-t border-border bg-muted/20 flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">* Required fields</p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={onClose} className="h-9">
                Cancel
              </Button>
              <Button type="submit" className="h-9 px-6 bg-primary text-primary-foreground hover:bg-primary/90">
                {initialProduct ? 'Save Changes' : 'Add Product'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}