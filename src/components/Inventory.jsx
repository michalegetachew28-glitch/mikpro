import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { Package, Search, Plus, Edit2, Trash2, AlertTriangle, ArrowUpRight, ArrowDownRight, Store, Camera, X } from 'lucide-react';
import { storeMedia, getMedia } from '../utils/idbStorage';
import { SkeletonCardGrid, SkeletonPageHeader } from './SkeletonLoader';
import './Inventory.css';

const Inventory = () => {
  const { inventory, staff, deleteItem, addItem, updateItem, t, language, requestConfirmation, isSyncing, isInitialLoadComplete } = useAppContext();
  const { currentUser } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [stockFilter, setStockFilter] = useState('all'); // 'all' | 'low' | 'instock'

  const permissions = currentUser?.permissions || [];
  const canManage = permissions.includes('all') ||
    permissions.includes('inventory_manage') ||
    currentUser?.role === 'inventoryManager' ||
    currentUser?.role === 'storekeeper' ||
    currentUser?.role === 'admin';

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [lightboxCaption, setLightboxCaption] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    quantity: 0,
    price: 0,
    threshold: 5,
    managerId: (currentUser.role === 'inventoryManager' || currentUser.role === 'storekeeper') ? currentUser.id : '',
    image: null
  });

  if (currentUser?.role === 'manager') {
    return (
      <div className="page-content">
        <div className="empty-state">
          <h2>{t("Access Denied")}</h2>
          <p>{t("managersNoInventoryPermission")}</p>
        </div>
      </div>
    );
  }

  const filteredItems = (inventory || []).filter(item => {
    const matchesSearch = (item.name || '').toLowerCase().includes(searchTerm.toLowerCase());

    // Stock level filter
    const isLow = parseInt(item.quantity) <= parseInt(item.threshold);
    const matchesStock =
      stockFilter === 'all' ||
      (stockFilter === 'low' && isLow) ||
      (stockFilter === 'instock' && !isLow);

    // Inventory Managers and Storekeepers see items assigned to them or unassigned items
    if (currentUser?.role === 'inventoryManager' || currentUser?.role === 'storekeeper') {
      const isAssignedToMe = String(item.managerId) === String(currentUser?.id);
      const isUnassigned = !item.managerId;
      return (isAssignedToMe || isUnassigned) && matchesSearch && matchesStock;
    }

    // Admins and others see all items
    return matchesSearch && matchesStock;
  });

  const handleOpenModal = (item = null) => {
    if (item) {
      setFormData({
        name: item.name, quantity: item.quantity, price: item.price, threshold: item.threshold,
        managerId: item.managerId || '',
        image: item.image || null
      });
      setEditingId(item.id);
    } else {
      setFormData({
        name: '',
        quantity: 0,
        price: 0,
        threshold: 5,
        managerId: (currentUser.role === 'inventoryManager' || currentUser.role === 'storekeeper') ? currentUser.id : '',
        image: null
      });
      setEditingId(null);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData({
      name: '',
      quantity: 0,
      price: 0,
      threshold: 5,
      managerId: (currentUser?.role === 'inventoryManager' || currentUser?.role === 'storekeeper') ? currentUser.id : ''
    });
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

const compressImageFile = (file, maxWidth = 800, maxHeight = 800, quality = 0.8) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      let imageId = formData.image;

      // If a new file was selected (it will be a File object, not an ID string)
      if (formData.imageFile) {
        try {
          imageId = await compressImageFile(formData.imageFile);
          const key = `img_${Date.now()}`;
          await storeMedia(key, formData.imageFile);
        } catch (err) {
          console.warn("Image compression failed, fallback to storeMedia", err);
          imageId = `img_${Date.now()}`;
          await storeMedia(imageId, formData.imageFile);
        }
      }

      if (editingId) {
        updateItem('inventory', editingId, {
          ...formData,
          name: formData.name,
          quantity: parseInt(formData.quantity) || 0,
          price: parseFloat(formData.price) || 0,
          threshold: parseInt(formData.threshold) || 0,
          managerId: formData.managerId || '',
          image: imageId
        });
      } else {
        const newItem = {
          id: `p${Date.now()}`,
          name: formData.name,
          quantity: parseInt(formData.quantity) || 0,
          price: parseFloat(formData.price) || 0,
          threshold: parseInt(formData.threshold) || 0,
          managerId: formData.managerId || ((currentUser.role === 'inventoryManager' || currentUser.role === 'storekeeper') ? currentUser.id : ''),
          image: imageId
        };
        addItem('inventory', newItem);
      }
      handleCloseModal();
    } catch (err) {
      console.error("Failed to add/update part:", err);
      alert(t("Failed to save part. Please check your inputs."));
    }
  };

  const handleStockAdjust = (id, amount) => {
    const item = (inventory || []).find(i => String(i.id) === String(id));
    if (!item) return;
    const currentQty = parseInt(item.quantity) || 0;
    const newQty = Math.max(0, currentQty + amount);
    updateItem('inventory', id, { ...item, quantity: newQty });
  };

  if (isSyncing && !isInitialLoadComplete) {
    return (
      <div className="page-content inventory-page">
        <SkeletonPageHeader />
        <div style={{ marginTop: 16 }}>
          <SkeletonCardGrid count={6} />
        </div>
      </div>
    );
  }

  return (
    <div className="page-content inventory-page">
      <div className="page-header">
        <div className="header-title">
          <div className="icon-wrapper"><Package size={28} /></div>
          <div>
            <h1>{t('inventory')}</h1>
            <p className="subtitle">{t("Track spare parts, materials, and stock levels.")}</p>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isSyncing && (
            <span style={{ fontSize: '0.8rem', color: 'var(--primary)', display: 'flex', alignItems: 'center', gap: 6, opacity: 0.8 }}>
              <span style={{ display: 'inline-block', width: 12, height: 12, border: '2px solid var(--primary)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              {t('Syncing...')}
            </span>
          )}
          {canManage && (
            <button className="btn-primary" onClick={() => handleOpenModal()}>
              <Plus size={18} /> {t("Add New Part")}
            </button>
          )}
        </div>
      </div>

      <div className="controls-bar">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input
            type="text"
            placeholder={t("Search by part name...")}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={stockFilter}
            onChange={(e) => setStockFilter(e.target.value)}
            style={{ padding: '8px 12px', borderRadius: 'var(--radius-btn)', border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.87rem', cursor: 'pointer' }}
          >
            <option value="all">{t('All Stock')}</option>
            <option value="low">{t('Low Stock')}</option>
            <option value="instock">{t('In Stock')}</option>
          </select>
        </div>
      </div>

      <div className="inventory-grid">
        {filteredItems.map(item => {
          const isLowStock = item.quantity <= item.threshold;
          const statusClass = isLowStock ? 'status-critical' : 'status-healthy';

          return (
            <div className={`inventory-card ${statusClass}`} key={item.id}>
              {item.image ? (
                <div
                  className="card-image-preview card-image-clickable"
                  title="Click to view full image"
                  onClick={() => { setLightboxSrc(item.image); setLightboxCaption(item.name || ''); }}
                >
                  <ItemImage mediaId={item.image} />
                </div>
              ) : (
                canManage && (
                  <div className="empty-image-placeholder" onClick={() => handleOpenModal(item)}>
                    <Camera size={24} />
                    <span>{t("Add Photo")}</span>
                  </div>
                )
              )}
              {isLowStock && (
                <div className="alert-ribbon">
                  <AlertTriangle size={14} /> {t("Low Stock")}
                </div>
              )}

              <div className="card-top">
                <div>
                  <h3 className="part-name">{item.name}</h3>
                  <div className="info-item" style={{ color: 'var(--primary)', fontWeight: 600, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Store size={14} />
                    <span>{(staff || []).find(s => String(s.id) === String(item.managerId))?.name || (t("Unassigned Shop"))}</span>
                  </div>
                </div>
                <div className="action-buttons">
                  {canManage && (
                    <>
                      <button className="icon-btn-small" onClick={() => handleOpenModal(item)}>
                        <Edit2 size={16} />
                      </button>
                      <button
                        className="icon-btn-small delete-btn"
                        onClick={() => requestConfirmation(t('confirmDeleteInventory'), () => deleteItem('inventory', item.id))}
                        title={t('deleteBtn')}
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="part-details">
                <div className="detail-stat">
                  <span className="stat-label">{t("Stock Level")}</span>
                  <div className={`stock-level-display ${isLowStock ? 'text-danger' : 'text-success'}`}>
                    <span className="qty">{item.quantity}</span>
                    <span className="unit">{t("units")}</span>
                  </div>
                </div>

                <div className="detail-stat">
                  <span className="stat-label">{t("Unit Price")}</span>
                  <div className="price-display">
                    {item.price.toFixed(0)} {t("ETB")}
                  </div>
                </div>
              </div>

              <div className="stock-adjuster">
                {canManage && (
                  <button className="adjust-btn minus" onClick={(e) => { e.stopPropagation(); handleStockAdjust(item.id, -1); }}>
                    <ArrowDownRight size={16} /> {t("Use")}
                  </button>
                )}
                <div className="progress-bar-container">
                  {(() => {
                    const threshold = parseInt(item.threshold) || 1;
                    const qty = parseInt(item.quantity) || 0;
                    const width = Math.min(100, (qty / (threshold * 2)) * 100);
                    return (
                      <div
                        className={`progress-fill ${isLowStock ? 'bg-danger' : 'bg-primary'}`}
                        style={{ width: `${width}%` }}
                      ></div>
                    );
                  })()}
                </div>
                {canManage && (
                  <button className="adjust-btn plus" onClick={(e) => { e.stopPropagation(); handleStockAdjust(item.id, 1); }}>
                    {t("Add")} <ArrowUpRight size={16} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h2>{editingId ? (t("Edit Part")) : (t("Add New Part"))}</h2>
              <button className="close-btn" onClick={handleCloseModal}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-group">
                <label>{t("Part Name")} *</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange} required placeholder={t("e.g. Synthetic Oil 5W-30")} />
              </div>

              <div className="form-group grid-2-col">
                <div>
                  <label>{t("Initial Quantity")} *</label>
                  <input type="number" name="quantity" value={formData.quantity} onChange={handleChange} required min="0" />
                </div>
                <div>
                  <label>{t("Low Stock Threshold")} *</label>
                  <input type="number" name="threshold" value={formData.threshold} onChange={handleChange} required min="1" />
                </div>
              </div>

              <div className="form-group">
                <label>{t("Unit Price")} ({t("ETB")}) *</label>
                <input type="number" name="price" value={formData.price} onChange={handleChange} required min="0" step="1" />
              </div>

              {/* Image Upload moved to bottom for better mobile accessibility */}
              <div className="form-group">
                <label>{t("Product Image")}</label>
                <div className="image-upload-area">
                  {formData.imageFile || formData.image ? (
                    <div className="upload-preview">
                      <ImagePreviewer source={formData.imageFile || formData.image} />
                      <button type="button" className="remove-img" onClick={() => setFormData(prev => ({ ...prev, image: null, imageFile: null }))}>
                        <X size={16} />
                      </button>
                    </div>
                  ) : (
                    <label className="upload-placeholder" style={{ borderStyle: 'dashed', borderWidth: '2px', height: '140px' }}>
                      <Camera size={32} />
                      <span>{t("Click or Tap to Upload Photo")}</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={(e) => setFormData(prev => ({ ...prev, imageFile: e.target.files[0] }))}
                        hidden
                      />
                    </label>
                  )}
                </div>
              </div>

              {(currentUser.role === 'admin' || currentUser.role === 'manager' || currentUser.role === 'coder') && (
                <div className="form-group">
                  <label>{t("Assign to Shop (Manager)")}</label>
                  <select
                    name="managerId"
                    value={formData.managerId}
                    onChange={handleChange}
                    className="auth-input"
                  >
                    <option value="">{t("Main Warehouse (Unassigned)")}</option>
                    {staff.filter(s => s.role === 'inventoryManager' || s.role === 'storekeeper' || s.role === 'admin' || s.role === 'manager').map(s => (
                      <option key={s.id} value={s.id}>{s.name} ({s.role})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="modal-actions">
                <button type="button" className="btn-text" onClick={handleCloseModal}>{t('cancel')}</button>
                <button type="submit" className="btn-primary">
                  {editingId ? t('save') : (t("Add Part"))}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Image Lightbox ── */}
      {lightboxSrc && (
        <div
          className="lightbox-overlay"
          onClick={() => setLightboxSrc(null)}
        >
          <div className="lightbox-container" onClick={e => e.stopPropagation()}>
            <button
              className="lightbox-close"
              onClick={() => setLightboxSrc(null)}
              title="Close"
            >
              <X size={22} />
            </button>
            {lightboxCaption && (
              <div className="lightbox-caption">{lightboxCaption}</div>
            )}
            <img
              src={lightboxSrc}
              alt={lightboxCaption}
              className="lightbox-image"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;

const ItemImage = ({ mediaId }) => {
  const [url, setUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  React.useEffect(() => {
    if (!mediaId) {
      setLoading(false);
      return;
    }
    let isMounted = true;
    if (typeof mediaId === 'string' && (mediaId.startsWith('http') || mediaId.startsWith('data:') || mediaId.startsWith('blob:'))) {
      setUrl(mediaId);
      setLoading(false);
      return;
    }

    getMedia(mediaId).then(data => {
      if (isMounted && data && data.blob) {
        setUrl(URL.createObjectURL(data.blob));
      } else if (isMounted && typeof mediaId === 'string') {
        setUrl(mediaId);
      }
      if (isMounted) setLoading(false);
    }).catch(() => {
      if (isMounted) {
        setUrl(mediaId);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      if (url && url.startsWith('blob:')) URL.revokeObjectURL(url);
    };
  }, [mediaId]);

  if (!mediaId) return null;
  if (loading) return <div className="img-skeleton" />;
  return (
    <img 
      src={url || mediaId} 
      alt="part" 
      className="part-thumb-img"
      draggable={false}
    />
  );
};

const ImagePreviewer = ({ source }) => {
  const [url, setUrl] = useState(null);

  React.useEffect(() => {
    if (!source) return;
    if (source instanceof File) {
      const u = URL.createObjectURL(source);
      setUrl(u);
      return () => URL.revokeObjectURL(u);
    } else if (typeof source === 'string' && (source.startsWith('http') || source.startsWith('data:') || source.startsWith('blob:'))) {
      setUrl(source);
    } else {
      getMedia(source).then(data => {
        if (data && data.blob) setUrl(URL.createObjectURL(data.blob));
        else setUrl(source);
      }).catch(() => setUrl(source));
    }
  }, [source]);

  if (!url && typeof source === 'string') return <img src={source} alt="preview" className="preview-img" />;
  if (!url) return <div className="img-skeleton" />;
  return <img src={url} alt="preview" className="preview-img" />;
};
