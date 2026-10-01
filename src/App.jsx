import { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownToLine,
  ArrowUpRight,
  Boxes,
  Check,
  ChevronDown,
  CircleDollarSign,
  Eye,
  EyeOff,
  LockKeyhole,
  LogOut,
  Mail,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { apiRequest, clearSession, readSession, registerAccount, saveSession, signIn, signOut } from './api.js';

const emptyProduct = { product_name: '', description: '', price: '', quantity: '' };
const money = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

function App() {
  const [session, setSession] = useState(readSession);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(Boolean(readSession()));
  const [dialog, setDialog] = useState(null);
  const [query, setQuery] = useState('');
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const updateSession = (nextSession) => {
    setSession(nextSession);
    saveSession(nextSession);
  };

  const loadProducts = async (activeSession = session) => {
    const data = await apiRequest('/products', {}, activeSession, updateSession);
    setProducts(data.products || []);
  };

  useEffect(() => {
    if (!session) {
      setLoading(false);
      return;
    }
    loadProducts(session)
      .catch((error) => {
        clearSession();
        setSession(null);
        setNotice({ kind: 'error', text: error.message || 'Your session has expired. Sign in again.' });
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(null), 3600);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const visibleProducts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return products;
    return products.filter((product) =>
      `${product.product_name} ${product.description || ''}`.toLowerCase().includes(term),
    );
  }, [products, query]);

  const inventoryValue = products.reduce((sum, product) => sum + Number(product.price) * Number(product.quantity), 0);
  const lowStock = products.filter((product) => Number(product.quantity) <= 5).length;
  const isAdmin = session?.user?.role === 'admin';

  const handleLogin = async (identifier, password) => {
    const data = await signIn(identifier, password);
    const nextSession = { user: data.user, tokens: data.tokens };
    updateSession(nextSession);
    setLoading(true);
    try {
      await loadProducts(nextSession);
    } catch (error) {
      clearSession();
      setSession(null);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (username, email, password) => {
    await registerAccount(username, email, password);
    setNotice({ kind: 'success', text: 'Account created. Sign in to continue.' });
  };

  const handleLogout = async () => {
    try {
      await signOut(session);
    } catch {
      // Clear the local session even if the API is unavailable.
    }
    clearSession();
    setSession(null);
    setProducts([]);
  };

  const saveProduct = async (product) => {
    setBusy(true);
    try {
      const editing = Boolean(dialog?.product?.id);
      await apiRequest(editing ? `/products/${dialog.product.id}` : '/products', {
        method: editing ? 'PUT' : 'POST',
        body: product,
      }, session, updateSession);
      await loadProducts();
      setDialog(null);
      setNotice({ kind: 'success', text: editing ? 'Product updated.' : 'Product added to inventory.' });
    } catch (error) {
      setNotice({ kind: 'error', text: error.message });
    } finally {
      setBusy(false);
    }
  };

  const deleteProduct = async (product) => {
    if (!window.confirm(`Delete “${product.product_name}” from inventory?`)) return;
    try {
      await apiRequest(`/products/${product.id}`, { method: 'DELETE' }, session, updateSession);
      setProducts((current) => current.filter((item) => item.id !== product.id));
      setNotice({ kind: 'success', text: 'Product deleted.' });
    } catch (error) {
      setNotice({ kind: 'error', text: error.message });
    }
  };

  if (!session) {
    return <AuthScreen onLogin={handleLogin} onRegister={handleRegister} notice={notice} />;
  }

  if (loading) {
    return <div className="loading-screen"><span className="spinner" />Connecting to inventory</div>;
  }

  return (
    <main className="app-shell">
      <aside className="rail">
        <a className="brand-mark" href="#home" aria-label="Stockroom home"><Boxes size={22} strokeWidth={2.2} /></a>
        <div className="rail-divider" />
        <button className="rail-item active" title="Products" aria-label="Products"><PackagePlus size={19} /></button>
        <div className="rail-bottom"><button className="rail-item" onClick={handleLogout} title="Sign out" aria-label="Sign out"><LogOut size={18} /></button></div>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>Products</strong></div>
          <div className="account-chip">
            <span className="avatar">{session.user?.username?.slice(0, 1).toUpperCase() || 'U'}</span>
            <span className="account-name">{session.user?.username}</span>
            <ChevronDown size={15} />
          </div>
        </header>

        <div className="page-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow"><span className="live-dot" />INVENTORY / 01</div>
              <h1>Product <span>register</span></h1>
              <p className="page-subtitle">A clear view of what is on your shelves.</p>
            </div>
            {isAdmin && <button className="button button-primary" onClick={() => setDialog({ product: null })}>
              <Plus size={17} /> Add product
            </button>}
          </div>

          <div className="metrics" aria-label="Inventory summary">
            <div className="metric">
              <div className="metric-label"><span>PRODUCTS</span><Boxes size={16} /></div>
              <div className="metric-value">{products.length.toString().padStart(2, '0')}<span className="metric-unit">items</span></div>
            </div>
            <div className="metric">
              <div className="metric-label"><span>STOCK VALUE</span><CircleDollarSign size={16} /></div>
              <div className="metric-value">{money.format(inventoryValue)}</div>
            </div>
            <div className="metric metric-warning">
              <div className="metric-label"><span>LOW STOCK</span><AlertCircle size={16} /></div>
              <div className="metric-value">{lowStock.toString().padStart(2, '0')}<span className="metric-unit">to review</span></div>
            </div>
          </div>

          <section className="catalog-section">
            <div className="section-head">
              <div>
                <div className="eyebrow">CATALOG</div>
                <h2>All products <span className="count-pill">{products.length}</span></h2>
              </div>
              <label className="search-field">
                <Search size={17} />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Find a product" aria-label="Search products" />
                <kbd>/</kbd>
              </label>
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr><th>PRODUCT</th><th>DESCRIPTION</th><th>UNIT PRICE</th><th>QUANTITY</th><th>ADDED</th><th><span className="sr-only">Actions</span></th></tr>
                </thead>
                <tbody>
                  {visibleProducts.map((product) => (
                    <tr key={product.id}>
                      <td><div className="product-cell"><span className="product-icon"><PackagePlus size={17} /></span><span><strong>{product.product_name}</strong><small>SKU-{String(product.id).padStart(5, '0')}</small></span></div></td>
                      <td className="description-cell">{product.description || <span className="muted">No description</span>}</td>
                      <td className="price-cell">{money.format(Number(product.price))}</td>
                      <td><span className={`stock-count ${Number(product.quantity) <= 5 ? 'stock-low' : ''}`}>{product.quantity}<small> units</small></span></td>
                      <td className="date-cell">{product.created_at ? new Date(product.created_at.replace(' ', 'T')).toLocaleDateString() : '—'}</td>
                      <td>{isAdmin && <div className="row-actions">
                        <button className="icon-button" title="Edit product" aria-label={`Edit ${product.product_name}`} onClick={() => setDialog({ product })}><Pencil size={16} /></button>
                        <button className="icon-button danger-hover" title="Delete product" aria-label={`Delete ${product.product_name}`} onClick={() => deleteProduct(product)}><Trash2 size={16} /></button>
                      </div>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {visibleProducts.length === 0 && (
                <div className="empty-state">
                  <span className="empty-icon"><ArrowDownToLine size={22} /></span>
                  <h3>{query ? 'No matching products' : 'Nothing on the shelves yet'}</h3>
                  <p>{query ? 'Try a different product name.' : 'Add the first product to start your register.'}</p>
                  {!query && isAdmin && <button className="button button-outline" onClick={() => setDialog({ product: null })}><Plus size={16} /> Add your first product</button>}
                </div>
              )}
            </div>
            <footer className="table-footer"><span>Showing <strong>{visibleProducts.length}</strong> of <strong>{products.length}</strong> products</span><span className="sync-state"><span className="live-dot" />LIVE INVENTORY</span></footer>
          </section>
          <footer className="page-footer"><span>STOCKROOM <span className="footer-mark">/</span> PRODUCT MANAGEMENT</span><span>BUILT FOR THE EVERYDAY COUNT</span></footer>
        </div>
      </section>

      {dialog && <ProductDialog product={dialog.product} busy={busy} onClose={() => setDialog(null)} onSave={saveProduct} />}
      {notice && <div className={`toast ${notice.kind}`} role="status"><span className="toast-icon">{notice.kind === 'success' ? <Check size={16} /> : <AlertCircle size={16} />}</span>{notice.text}<button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={15} /></button></div>}
    </main>
  );
}

function AuthScreen({ onLogin, onRegister, notice }) {
  const [mode, setMode] = useState('login');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      if (mode === 'register') {
        await onRegister(form.get('username'), form.get('email'), form.get('password'));
        setMode('login');
      } else {
        await onLogin(form.get('identifier'), form.get('password'));
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="auth-layout">
      <section className="auth-art">
        <div className="auth-art-top"><span className="brand-mark brand-mark-light"><Boxes size={22} /></span><span>STOCKROOM <i>/</i> 01</span></div>
        <div className="art-graphic" aria-hidden="true">
          <div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" />
          <div className="art-box box-back"><span /><span /><span /></div>
          <div className="art-box box-front"><span /><span /><span /></div>
          <div className="art-stamp">EST.<br />2025</div>
          <div className="art-coordinates">INVENTORY<br />SYSTEM / 01</div>
        </div>
        <div className="auth-art-copy"><span className="eyebrow">THE DAILY COUNT</span><h1>Know what<br />you <em>have.</em></h1><p>Product records, kept close and up to date.</p></div>
        <div className="auth-art-bottom"><span>PRODUCT MANAGEMENT</span><span>01 — 03</span></div>
      </section>
      <section className="auth-panel">
        <div className="auth-mobile-brand"><span className="brand-mark"><Boxes size={21} /></span><span>STOCKROOM</span></div>
        <div className="auth-form-wrap">
          <div className="auth-kicker"><span className="live-dot" />SECURE WORKSPACE</div>
          <h2>{mode === 'login' ? 'Welcome back.' : 'Create account.'}</h2>
          <p className="auth-description">{mode === 'login' ? 'Sign in to your inventory workspace.' : 'Set up access to your inventory workspace.'}</p>
          {notice && <div className={`inline-notice ${notice.kind}`}>{notice.text}</div>}
          {error && <div className="inline-notice error"><AlertCircle size={16} />{error}</div>}
          <form className="auth-form" onSubmit={submit}>
            {mode === 'register' && <label className="field-label">USERNAME<input name="username" autoComplete="username" required minLength="2" maxLength="100" placeholder="Your name" /></label>}
            {mode === 'register' ? (
              <label className="field-label">EMAIL ADDRESS<span className="input-wrap"><Mail size={17} /><input name="email" type="email" autoComplete="email" required placeholder="you@example.com" /></span></label>
            ) : (
              <label className="field-label">USERNAME OR EMAIL<span className="input-wrap"><Mail size={17} /><input name="identifier" autoComplete="username" required placeholder="Enter your username or email" /></span></label>
            )}
            <label className="field-label">PASSWORD<span className="input-wrap"><LockKeyhole size={17} /><input name="password" type={showPassword ? 'text' : 'password'} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} required minLength={mode === 'register' ? 8 : undefined} placeholder={mode === 'login' ? 'Enter your password' : 'At least 8 characters'} /><button className="password-toggle" type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'Hide password' : 'Show password'}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
            <button className="button button-primary auth-submit" type="submit" disabled={busy}>{busy ? <span className="spinner spinner-small" /> : mode === 'login' ? 'Sign in' : 'Create account'}<ArrowUpRight size={17} /></button>
            {mode === 'login' && <div className="admin-note"><strong>Admin demo account</strong><span>Username: <code>admin</code> &nbsp; Password: <code>admin</code></span></div>}
          </form>
          <div className="auth-switch"><span>{mode === 'login' ? 'New to this workspace?' : 'Already have an account?'}</span><button onClick={() => { setError(''); setMode(mode === 'login' ? 'register' : 'login'); }}>{mode === 'login' ? 'Create account' : 'Sign in'}</button></div>
        </div>
        <div className="auth-panel-footer"><span>ACCESS IS ENCRYPTED</span><span>STOCKROOM © 2025</span></div>
      </section>
    </main>
  );
}

function ProductDialog({ product, busy, onClose, onSave }) {
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    setError('');
    const form = new FormData(event.currentTarget);
    const values = {
      product_name: String(form.get('product_name')).trim(),
      description: String(form.get('description')).trim(),
      price: String(form.get('price')),
      quantity: String(form.get('quantity')),
    };
    if (!values.product_name || Number(values.price) < 0 || Number(values.quantity) < 0) {
      setError('Enter a product name, valid price, and non-negative quantity.');
      return;
    }
    await onSave(values);
  };

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && !busy && onClose()}>
      <section className="product-dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <header className="dialog-header"><div><span className="eyebrow">PRODUCT REGISTER / {product ? 'EDIT' : 'NEW ENTRY'}</span><h2 id="dialog-title">{product ? 'Edit product' : 'Add a product'}</h2></div><button className="icon-button dialog-close" onClick={onClose} aria-label="Close" disabled={busy}><X size={19} /></button></header>
        <form onSubmit={submit}>
          <label className="field-label">PRODUCT NAME<input name="product_name" required maxLength="100" defaultValue={product?.product_name || ''} placeholder="e.g. Ceramic pour-over" autoFocus /></label>
          <label className="field-label">DESCRIPTION <span className="optional">OPTIONAL</span><textarea name="description" rows="3" defaultValue={product?.description || ''} placeholder="A short note about this item" /></label>
          <div className="form-row">
            <label className="field-label">PRICE <span className="optional">PHP</span><input name="price" type="number" min="0" step="0.01" required defaultValue={product?.price ?? ''} placeholder="0.00" /></label>
            <label className="field-label">QUANTITY <span className="optional">UNITS</span><input name="quantity" type="number" min="0" step="1" required defaultValue={product?.quantity ?? ''} placeholder="0" /></label>
          </div>
          {error && <div className="inline-notice error"><AlertCircle size={16} />{error}</div>}
          <footer className="dialog-footer"><button className="button button-text" type="button" onClick={onClose} disabled={busy}>Cancel</button><button className="button button-primary" type="submit" disabled={busy}>{busy ? <span className="spinner spinner-small" /> : <Check size={16} />}{product ? 'Save changes' : 'Add product'}</button></footer>
        </form>
      </section>
    </div>
  );
}

export default App;