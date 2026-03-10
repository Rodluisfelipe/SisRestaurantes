import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import ProductCard from './Productcard';
import ProductToppingsSelector from './ProductToppingsSelector';
import { useBusinessConfig } from '../Context/BusinessContext';
import FeaturedProducts from './FeaturedProducts';
import PendingReviewCard from './PendingReviewCard';
import { NoSearchResultsIllustration, EmptyMenuIllustration } from './EmptyStates';

/* ── SVG Icons (stroke-based, admin panel style) ── */
const MI = {
  search: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  x: (cls = 'w-3.5 h-3.5') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>,
  grid: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  chevron: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M9 5l7 7-7 7"/></svg>,
  package: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 002 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0022 16z"/><path d="M3.27 6.96L12 12.01l8.73-5.05M12 22.08V12"/></svg>,
  clipboard: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 012 2v14a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>,
  check: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>,
  sparkle: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z"/></svg>,
};

/* ── Category SVG Icons (stroke-based, matching the design system) ── */
const CI = {
  // Burger / Hamburguesa
  burger: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M4 15h16a1 1 0 010 2H4a1 1 0 010-2z"/><path d="M5 15V13a7 7 0 0114 0v2"/><path d="M4 17v1a2 2 0 002 2h12a2 2 0 002-2v-1"/><path d="M8 13h.01M12 13h.01M16 13h.01"/></svg>,
  // Pizza
  pizza: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L4 20h16L12 2z"/><circle cx="10" cy="13" r="1"/><circle cx="14" cy="11" r="1"/><circle cx="11" cy="8" r="1"/></svg>,
  // Bebida / Drink — glass with straw
  drink: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M17 8H7l1 13a1 1 0 001 1h6a1 1 0 001-1l1-13z"/><path d="M7 8l-1-4h12l-1 4"/><path d="M14 4l2-2"/></svg>,
  // Coffee / Café
  coffee: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M17 8h1a4 4 0 010 8h-1"/><path d="M3 8h14v9a4 4 0 01-4 4H7a4 4 0 01-4-4V8z"/><path d="M6 2v3M10 2v3M14 2v3"/></svg>,
  // Postre / Dessert — cake
  dessert: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M4 18h16v2a1 1 0 01-1 1H5a1 1 0 01-1-1v-2z"/><path d="M4 18v-2a8 8 0 0116 0v2"/><path d="M12 4v4"/><circle cx="12" cy="3" r="1"/></svg>,
  // Entrada / Appetizer — small plate
  appetizer: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="14" rx="9" ry="4"/><path d="M3 14v1a9 4 0 0018 0v-1"/><path d="M12 6v4M9 8l3-4 3 4"/></svg>,
  // Ensalada / Salad — leaf
  salad: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.5S2 11.5 2 13.5s1.75 3.75 1.75 3.75"/></svg>,
  // Sopa / Soup — bowl with steam
  soup: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18"/><path d="M5 12v2a7 7 0 0014 0v-2"/><path d="M9 4c0 1.5-1 2-1 3M12 4c0 1.5-1 2-1 3M15 4c0 1.5-1 2-1 3"/></svg>,
  // Pollo / Chicken — drumstick
  chicken: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M15.5 2.5a5 5 0 010 7.07l-5.66 5.66a2 2 0 01-2.83 0l-.7-.71a2 2 0 010-2.83l5.65-5.65a5 5 0 017.07 0z" transform="rotate(-10 12 12)"/><path d="M7 14l-4 4M8 17l-2 2"/></svg>,
  // Pasta / Noodles
  pasta: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h18"/><path d="M5 12c0 5 3 8 7 8s7-3 7-8"/><path d="M6 4c0 2.5 2 4 6 4s6-1.5 6-4"/><path d="M6 4v8M18 4v8M12 4v8"/></svg>,
  // Mariscos / Seafood — fish
  seafood: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M6.34 18.66l-2.83-2.83a2 2 0 010-2.83l9.9-9.9a2 2 0 012.83 0l2.83 2.83a2 2 0 010 2.83l-9.9 9.9a2 2 0 01-2.83 0z" transform="rotate(-15 12 12)"/><path d="M2 22l4-4M18 6l4-4"/><circle cx="15" cy="9" r="1"/></svg>,
  // Taco
  taco: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M4 18a8 8 0 0116 0"/><path d="M4 18c0 1 2 3 8 3s8-2 8-3"/><path d="M8 14v-2M12 14v-3M16 14v-2"/></svg>,
  // Sandwich / Wrap
  sandwich: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M3 17l9-14 9 14H3z"/><path d="M6 17h12"/><path d="M8 13h8"/></svg>,
  // Desayuno / Breakfast — egg & toast
  breakfast: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="13" r="6"/><circle cx="10" cy="13" r="2"/><path d="M18 8h2a2 2 0 012 2v4a2 2 0 01-2 2h-2V8z"/><path d="M18 8H14"/></svg>,
  // Combo — stacked boxes
  combo: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="13" width="10" height="9" rx="1"/><rect x="12" y="9" width="10" height="13" rx="1"/><path d="M2 17h10M12 15h10"/></svg>,
  // Almuerzo / Cena — plate with utensils
  meal: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8"/><circle cx="12" cy="13" r="4"/><path d="M3 3l3 7M21 3l-3 7"/></svg>,
  // Arroz / Rice — bowl
  rice: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M4 12h16"/><path d="M5 12c0 5.5 3.5 9 7 9s7-3.5 7-9"/><path d="M8 9c0-2 2-4 4-4s4 2 4 4"/></svg>,
  // Snack — cookie/chip
  snack: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="9" cy="10" r="1"/><circle cx="14" cy="9" r="1"/><circle cx="11" cy="14" r="1"/><circle cx="15" cy="14" r="1"/></svg>,
  // Default — utensils
  utensils: (cls = 'w-4 h-4') => <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round"><path d="M3 2v20M7 2v8a4 4 0 01-4 4"/><path d="M7 2v8a4 4 0 004 4v8"/><path d="M21 2v4a7 4 0 01-7 4v12"/><path d="M21 2c-1 0-3 1-3 4"/></svg>,
};

/* ── Map category name → SVG icon ── */
const getCategoryIcon = (categoryName, cls = 'w-4 h-4') => {
  const name = (categoryName || '').toLowerCase().trim();
  const map = {
    'hamburguesas': 'burger', 'hamburguesa': 'burger', 'burgers': 'burger', 'burger': 'burger',
    'pizza': 'pizza', 'pizzas': 'pizza',
    'bebidas': 'drink', 'bebida': 'drink', 'drinks': 'drink', 'bebidas frías': 'drink', 'bebidas frias': 'drink',
    'bebidas calientes': 'coffee', 'café': 'coffee', 'cafés': 'coffee', 'cafe': 'coffee', 'coffee': 'coffee',
    'jugos': 'drink', 'jugo': 'drink', 'batidos': 'drink', 'batido': 'drink', 'malteadas': 'drink',
    'postres': 'dessert', 'postre': 'dessert', 'desserts': 'dessert', 'dulces': 'dessert',
    'entradas': 'appetizer', 'entrada': 'appetizer', 'appetizers': 'appetizer', 'aperitivos': 'appetizer',
    'ensaladas': 'salad', 'ensalada': 'salad', 'salads': 'salad',
    'sopas': 'soup', 'sopa': 'soup', 'caldos': 'soup', 'cremas': 'soup',
    'pollo': 'chicken', 'pollos': 'chicken', 'alitas': 'chicken', 'chicken': 'chicken',
    'pasta': 'pasta', 'pastas': 'pasta',
    'mariscos': 'seafood', 'pescado': 'seafood', 'pescados': 'seafood', 'seafood': 'seafood',
    'tacos': 'taco', 'taco': 'taco',
    'wraps': 'sandwich', 'wrap': 'sandwich', 'burritos': 'sandwich', 'burrito': 'sandwich',
    'sandwiches': 'sandwich', 'sandwich': 'sandwich', 'sándwiches': 'sandwich',
    'desayunos': 'breakfast', 'desayuno': 'breakfast', 'breakfast': 'breakfast',
    'almuerzos': 'meal', 'almuerzo': 'meal', 'cenas': 'meal', 'cena': 'meal', 'platos fuertes': 'meal', 'plato fuerte': 'meal',
    'combos': 'combo', 'combo': 'combo', 'promociones': 'combo', 'ofertas': 'combo',
    'arroz': 'rice', 'arroces': 'rice',
    'snacks': 'snack', 'snack': 'snack', 'acompañamientos': 'snack', 'acompañamiento': 'snack', 'extras': 'snack', 'complementos': 'snack',
  };

  // Exact match
  if (map[name]) return CI[map[name]](cls);

  // Partial match
  if (name.includes('burger') || name.includes('hamburguesa')) return CI.burger(cls);
  if (name.includes('pizza')) return CI.pizza(cls);
  if (name.includes('bebida') || name.includes('drink') || name.includes('jugo') || name.includes('batido')) return CI.drink(cls);
  if (name.includes('café') || name.includes('cafe') || name.includes('coffee')) return CI.coffee(cls);
  if (name.includes('postre') || name.includes('dessert') || name.includes('dulce')) return CI.dessert(cls);
  if (name.includes('entrada') || name.includes('appetizer')) return CI.appetizer(cls);
  if (name.includes('ensalada') || name.includes('salad')) return CI.salad(cls);
  if (name.includes('sopa') || name.includes('caldo') || name.includes('crema')) return CI.soup(cls);
  if (name.includes('pollo') || name.includes('chicken') || name.includes('alita')) return CI.chicken(cls);
  if (name.includes('pasta')) return CI.pasta(cls);
  if (name.includes('marisco') || name.includes('pescado') || name.includes('seafood')) return CI.seafood(cls);
  if (name.includes('taco')) return CI.taco(cls);
  if (name.includes('sandwich') || name.includes('wrap') || name.includes('burrito')) return CI.sandwich(cls);
  if (name.includes('desayuno') || name.includes('breakfast')) return CI.breakfast(cls);
  if (name.includes('almuerzo') || name.includes('cena') || name.includes('plato')) return CI.meal(cls);
  if (name.includes('combo') || name.includes('promo')) return CI.combo(cls);
  if (name.includes('arroz') || name.includes('rice')) return CI.rice(cls);
  if (name.includes('snack') || name.includes('extra') || name.includes('complement')) return CI.snack(cls);

  return CI.utensils(cls);
};

/**
 * FilterableMenu Component
 * 
 * A modern component for displaying products with category filtering, search capabilities,
 * and view toggle options with premium animations.
 */
const FilterableMenu = ({ 
  products, 
  categories, 
  addToCart, 
  onToppingsOpen, 
  onToppingsClose,
  subscriptionStatus = null,
  businessId,
  businessConfig: businessConfigProp,
  hasActiveOrder = false,
  activeOrderStatus = null,
  onViewActiveOrder,
  onDismissCompletedOrder,
  customerPhone = null,
  onCategoryVisible,
  onPendingReview
}) => {
  const [activeCategory, setActiveCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [showToppings, setShowToppings] = useState(false);
  const { businessConfig: businessConfigContext } = useBusinessConfig();
  const businessConfig = businessConfigProp || businessConfigContext;

  // ── Scroll-spy + sticky state ──
  const [spyCategory, setSpyCategory] = useState('all');  // category visible by scroll
  const [isSticky, setIsSticky] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [searchFocused, setSearchFocused] = useState(false);
  const [userTapped, setUserTapped] = useState(false);     // true while programmatic scroll
  const pillBarRef = useRef(null);
  const pillBarSentinelRef = useRef(null);
  const sectionRefs = useRef({});                           // { categoryId: HTMLDivElement }
  const pillRefs = useRef({});                              // { categoryId: HTMLButtonElement }
  const userTapTimer = useRef(null);

  // Animation variants for stagger effect
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100
      }
    }
  };

  // Sort categories based on displayOrder from backend
  const getSortedCategories = (categories) => {
    // Validar que categories sea un array
    if (!Array.isArray(categories)) {
      console.warn('getSortedCategories: categories no es un array:', categories);
      return [];
    }
    
    // Ordenar por displayOrder (del backend) y luego por fecha de creación
    return [...categories].sort((a, b) => {
      const orderA = a.displayOrder !== undefined ? a.displayOrder : 999;
      const orderB = b.displayOrder !== undefined ? b.displayOrder : 999;
      
      if (orderA === orderB) {
        // Si tienen el mismo orden, ordenar por fecha de creación
        return new Date(a.createdAt) - new Date(b.createdAt);
      }
      
      return orderA - orderB;
    });
  };

  // ── Sticky detection via sentinel ──
  useEffect(() => {
    const sentinel = pillBarSentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      ([entry]) => setIsSticky(!entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, []);

  // ── Scroll-spy: IntersectionObserver watches each category section ──
  useEffect(() => {
    if (userTapped) return; // pause spy while programmatic scroll is in-flight
    const sections = Object.entries(sectionRefs.current).filter(([, el]) => el);
    if (sections.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        // Find the topmost visible section
        let topEntry = null;
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            if (!topEntry || entry.boundingClientRect.top < topEntry.boundingClientRect.top) {
              topEntry = entry;
            }
          }
        });
        if (topEntry) {
          setSpyCategory(topEntry.target.getAttribute('data-category-id'));
        }
      },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0 }
    );

    sections.forEach(([, el]) => obs.observe(el));
    return () => obs.disconnect();
  }, [userTapped, filteredProducts]);

  // ── Notify parent of visible category (for viewer tracking) ──
  useEffect(() => {
    if (onCategoryVisible && spyCategory && spyCategory !== 'all') {
      const cat = categories.find(c => c._id === spyCategory);
      if (cat) onCategoryVisible(cat.name);
    }
  }, [spyCategory, categories, onCategoryVisible]);

  // ── Scroll progress (how far through the menu) ──
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY || document.documentElement.scrollTop;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        setScrollProgress(Math.min(scrollTop / docHeight, 1));
      }
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ── Auto-scroll the active pill into view (horizontal only, on tap only) ──
  const scrollPillIntoView = useCallback((categoryId) => {
    const pillEl = pillRefs.current[categoryId] || pillRefs.current['all'];
    const container = pillBarRef.current?.querySelector('.overflow-x-auto');
    if (pillEl && container) {
      const containerRect = container.getBoundingClientRect();
      const pillRect = pillEl.getBoundingClientRect();
      const scrollLeft = pillEl.offsetLeft - container.offsetLeft - (containerRect.width / 2) + (pillRect.width / 2);
      container.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
    }
  }, []);

  // ── Click a pill: scroll to section + highlight (stay in "all" mode) ──
  const handlePillClick = useCallback((categoryId) => {
    if (categoryId === 'all') {
      setActiveCategory('all');
      setSpyCategory('all');
      scrollPillIntoView('all');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    // Immediately highlight this pill and scroll it into view
    setSpyCategory(categoryId);
    scrollPillIntoView(categoryId);
    // Keep showing all sections so scroll targets exist
    setActiveCategory('all');

    const section = sectionRefs.current[categoryId];
    if (section) {
      // Temporarily disable spy so it doesn't fight with programmatic scroll
      setUserTapped(true);
      clearTimeout(userTapTimer.current);

      const offset = pillBarRef.current ? pillBarRef.current.offsetHeight + 12 : 60;
      const top = section.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: 'smooth' });

      // Re-enable spy after scroll finishes (generous timeout for slow devices)
      userTapTimer.current = setTimeout(() => {
        setUserTapped(false);
      }, 1200);
    }
  }, []);

  // Filter products based on search and category
  useEffect(() => {
    let filtered = products;

    // Filter only active products (hide inactive products from customers)
    filtered = filtered.filter(product => product.active !== false);

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // Filter by category
    if (activeCategory !== 'all') {
      filtered = filtered.filter(product => product.category === activeCategory);
    }

    setFilteredProducts(filtered);
  }, [products, searchTerm, activeCategory]);

  // Handle search input
  const handleSearchChange = (e) => {
    setSearchTerm(e.target.value);
  };

  // Clear search
  const clearSearch = () => {
    setSearchTerm('');
  };

  // Handle showing toppings selector
  const handleShowToppings = (product) => {
    // Verificar si la suscripción está suspendida
    if (subscriptionStatus === 'suspended') {
      // Mensaje sutil - no mostrar alert, el botón ya está deshabilitado visualmente
      return;
    }
    
    setSelectedProduct(product);
    setShowToppings(true);
    onToppingsOpen && onToppingsOpen();
    document.body.classList.add('modal-open');
  };

  // Handle closing toppings selector
  const handleCloseToppings = () => {
    setShowToppings(false);
    setSelectedProduct(null);
    onToppingsClose && onToppingsClose();
    document.body.classList.remove('modal-open');
  };

  // Handle adding product with toppings to cart
  const handleAddToCartWithToppings = (productWithToppings) => {
    addToCart(productWithToppings);
    handleCloseToppings();
  };

  // Get sorted categories
  const sortedCategories = getSortedCategories(categories);

  // Get categories with product counts
  const categoriesWithProducts = sortedCategories.map(category => ({
    ...category,
    count: Array.isArray(products) ? products.filter(product => product.category === category._id).length : 0
  })).filter(category => category.count > 0);

  // Total product count
  const totalProductCount = Array.isArray(products) ? products.length : 0;

  const themeColor = businessConfig?.theme?.buttonColor || '#f97316';
  const themeTextColor = businessConfig?.theme?.buttonTextColor || '#ffffff';

  // The visually active pill is always based on spyCategory
  // (either set by IntersectionObserver or explicitly by handlePillClick)
  const visualActive = spyCategory;
  
  return (
    <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-2">
      {/* Active Order Banner — Rappi style, above search */}
      <AnimatePresence>
        {hasActiveOrder && (() => {
          const isCompleted = activeOrderStatus === 'completed' || activeOrderStatus === 'ready';
          const statusMap = {
            pending_payment: { label: 'Pendiente de pago', icon: MI.clipboard('w-5 h-5 text-white'), sub: 'Realiza el pago para continuar' },
            payment_uploaded: { label: 'Verificando pago', icon: MI.clipboard('w-5 h-5 text-white'), sub: 'El restaurante revisa tu comprobante' },
            payment_confirmed: { label: 'Pago confirmado', icon: MI.check('w-5 h-5 text-white'), sub: 'Tu pedido será preparado pronto' },
            pending: { label: 'Pedido recibido', icon: MI.clipboard('w-5 h-5 text-white'), sub: 'El restaurante recibió tu pedido' },
            inProgress: { label: 'En preparación', icon: MI.package('w-5 h-5 text-white'), sub: 'Están preparando tu pedido' },
            ready: { label: 'Pedido listo', icon: MI.sparkle('w-5 h-5 text-white'), sub: 'Tu pedido está listo para recoger' },
            completed: { label: 'Pedido completado', icon: MI.check('w-5 h-5 text-white'), sub: 'Tu pedido ha sido entregado' },
          };
          const info = statusMap[activeOrderStatus] || { label: 'Pedido en curso', icon: MI.clipboard('w-5 h-5 text-white'), sub: 'Toca para ver el estado' };

          return (
            <motion.div
              key="active-order-banner"
              initial={{ opacity: 0, scaleY: 0 }}
              animate={{ opacity: 1, scaleY: 1 }}
              exit={{ opacity: 0, scaleY: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full mb-3 rounded-2xl overflow-hidden shadow-sm origin-top"
              style={{ backgroundColor: isCompleted ? '#10b981' : themeColor }}
            >
              <button
                onClick={isCompleted ? undefined : onViewActiveOrder}
                className="w-full active:scale-[0.98] transition-transform"
                aria-label={isCompleted ? 'Pedido completado' : `Ver pedido activo: ${info.label}`}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="relative flex-shrink-0">
                    <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center">
                      {info.icon}
                    </div>
                    {!isCompleted && (
                      <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75 will-change-transform" />
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-white" />
                      </span>
                    )}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-semibold leading-tight text-white">
                      {info.label}
                    </p>
                    <p className="text-xs mt-0.5 text-white/90">
                      {info.sub}
                    </p>
                  </div>
                  {!isCompleted && (
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
              {isCompleted ? (
                <button
                  onClick={onDismissCompletedOrder}
                  className="w-full py-2 bg-white/20 text-white text-xs font-semibold tracking-wide active:bg-white/30 transition-colors"
                >
                  OK, ENTENDIDO
                </button>
              ) : (
                <div className="h-0.5 bg-white/20">
                  <motion.div
                    className="h-full bg-white/50 rounded-full w-full origin-left"
                    animate={{ scaleX: [0, 1] }}
                    transition={{ repeat: Infinity, duration: 2.5, ease: 'easeInOut' }}
                  />
                </div>
              )}
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* Pending Review Card — shown when no active order and customer has un-reviewed orders */}
      {!hasActiveOrder && customerPhone && (
        <PendingReviewCard
          businessId={businessId}
          customerPhone={customerPhone}
          themeColor={themeColor}
          onReview={onPendingReview}
        />
      )}

      {/* Spotlight Search — iOS style */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 sm:mb-5 relative z-50"
      >
        {/* Backdrop blur when focused (no text) */}
        <AnimatePresence>
          {searchFocused && !searchTerm && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
              onClick={() => { setSearchFocused(false); document.activeElement?.blur(); }}
            />
          )}
        </AnimatePresence>

        <div className={`relative z-50 transition-transform duration-300 ${searchFocused && !searchTerm ? 'scale-[1.02]' : ''}`}>
          <span
            className="absolute left-3.5 sm:left-4 top-1/2 -translate-y-1/2 pointer-events-none transition-colors z-10"
            style={{ color: searchTerm ? themeColor : '#94a3b8' }}
          >
            {MI.search('w-[18px] h-[18px] sm:w-5 sm:h-5')}
          </span>
          <input
            type="text"
            placeholder="¿Qué se te antoja hoy?"
            value={searchTerm}
            onChange={handleSearchChange}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setTimeout(() => setSearchFocused(false), 250)}
            className={`w-full pl-10 sm:pl-12 pr-10 py-3 sm:py-3.5 border rounded-2xl focus:outline-none focus:ring-2 transition-all duration-200 text-sm sm:text-base text-slate-700 placeholder-slate-400 ${
              searchFocused ? 'bg-white border-transparent shadow-2xl' : 'bg-slate-50 border-slate-200'
            }`}
            style={{
              '--tw-ring-color': `${themeColor}40`,
              borderColor: searchTerm ? themeColor : undefined
            }}
          />
          <AnimatePresence>
            {searchTerm && (
              <motion.button 
                initial={{ opacity: 0, scale: 0 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0 }}
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center rounded-lg bg-slate-200 text-slate-500 hover:bg-slate-300 transition-colors z-10"
                aria-label="Limpiar búsqueda"
              >
                {MI.x('w-3 h-3')}
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Quick suggestion chips */}
        <AnimatePresence>
          {searchFocused && !searchTerm && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ delay: 0.1 }}
              className="relative z-50 flex flex-wrap gap-2 mt-3"
            >
              {categoriesWithProducts.slice(0, 5).map(cat => (
                <motion.button
                  key={cat._id}
                  whileTap={{ scale: 0.93 }}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => { setSearchTerm(cat.name); setSearchFocused(false); }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/90 backdrop-blur-md text-slate-700 shadow-md border border-white/50 active:bg-white transition-all"
                >
                  <span className="opacity-60">{getCategoryIcon(cat.name, 'w-3 h-3')}</span>
                  {cat.name}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Sentinel — when this scrolls out of view, the pill bar becomes sticky */}
      <div ref={pillBarSentinelRef} className="h-0" />

      {/* ── Sticky Category Filter Pills + Progress Bar ── */}
      <div
        ref={pillBarRef}
        className={`z-40 ${
          isSticky
            ? 'sticky top-0 bg-white/95 backdrop-blur-md shadow-sm -mx-3 px-3 sm:-mx-4 sm:px-4 lg:-mx-6 lg:px-6 py-2.5 mb-4 sm:mb-5'
            : 'mb-4 sm:mb-5'
        }`}
      >
        <div className="overflow-x-auto scrollbar-hide">
          <LayoutGroup>
          <div className="flex gap-2 pb-1 px-0.5 min-w-max">
            {/* "All" pill — iOS style */}
            <motion.button
              ref={el => (pillRefs.current['all'] = el)}
              onClick={() => handlePillClick('all')}
              whileTap={{ scale: 0.93 }}
              className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap font-semibold text-[13px] transition-colors duration-200"
              style={{ color: visualActive === 'all' ? '#fff' : '#334155' }}
            >
              {visualActive === 'all' && (
                <motion.div
                  layoutId="activePillBg"
                  className="absolute inset-0 rounded-full"
                  style={{ backgroundColor: '#0f172a', boxShadow: '0 4px 12px rgba(15,23,42,0.25)' }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              {visualActive !== 'all' && (
                <div className="absolute inset-0 rounded-full bg-slate-100" />
              )}
              <span className="relative z-10">Todos</span>
              <span className={`relative z-10 min-w-[20px] h-5 inline-flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 ${
                visualActive === 'all' 
                  ? 'bg-white/20 text-white' 
                  : 'bg-slate-200 text-slate-500'
              }`}>
                {totalProductCount}
              </span>
            </motion.button>

            {/* Category pills — iOS minimal with count bubble */}
            {categoriesWithProducts.map((category) => {
              const isActive = visualActive === category._id;
              return (
                <motion.button
                  key={category._id}
                  ref={el => (pillRefs.current[category._id] = el)}
                  onClick={() => handlePillClick(category._id)}
                  whileTap={{ scale: 0.93 }}
                  className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap font-semibold text-[13px] transition-colors duration-200"
                  style={{ color: isActive ? '#fff' : '#334155' }}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activePillBg"
                      className="absolute inset-0 rounded-full"
                      style={{ backgroundColor: '#0f172a', boxShadow: '0 4px 12px rgba(15,23,42,0.25)' }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  {!isActive && (
                    <div className="absolute inset-0 rounded-full bg-slate-100" />
                  )}
                  <span className="relative z-10">{category.name}</span>
                  <span className={`relative z-10 min-w-[20px] h-5 inline-flex items-center justify-center rounded-full text-[10px] font-bold px-1.5 ${
                    isActive 
                      ? 'bg-white/20 text-white' 
                      : 'bg-slate-200 text-slate-500'
                  }`}>
                    {category.count}
                  </span>
                </motion.button>
              );
            })}
          </div>
          </LayoutGroup>
        </div>

        {/* ── Scroll progress line ── */}
        <div className="h-[2px] bg-slate-100 mt-2 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full w-full origin-left"
            style={{ backgroundColor: themeColor }}
            animate={{ scaleX: scrollProgress }}
            transition={{ duration: 0.1, ease: 'linear' }}
          />
        </div>
      </div>

      {/* Productos Destacados */}
      {businessId && (
        <FeaturedProducts
          businessId={businessId}
          onAddToCart={addToCart}
          theme={businessConfig?.theme}
          onToppingsOpen={onToppingsOpen}
          onToppingsClose={onToppingsClose}
        />
      )}

      {/* Products Display */}
      <AnimatePresence mode="wait">
        {/* ── No results state ── */}
        {filteredProducts.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center py-10 px-4 text-center"
          >
            {searchTerm ? (
              <>
                <NoSearchResultsIllustration themeColor={themeColor} size={150} />
                <h3 className="mt-4 text-lg font-bold text-gray-700">
                  No encontramos resultados
                </h3>
                <p className="mt-1.5 text-sm text-gray-500 max-w-xs">
                  No hay productos que coincidan con <span className="font-semibold text-gray-600">"{searchTerm}"</span>
                </p>
                <button
                  onClick={clearSearch}
                  className="mt-4 px-5 py-2 text-sm font-semibold rounded-full transition-colors"
                  style={{ backgroundColor: `${themeColor}15`, color: themeColor }}
                >
                  Limpiar búsqueda
                </button>

                {/* Suggest popular categories */}
                {categoriesWithProducts.length > 0 && (
                  <div className="mt-6 w-full">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Explora categorías</p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {categoriesWithProducts.slice(0, 4).map(cat => (
                        <motion.button
                          key={cat._id}
                          whileTap={{ scale: 0.93 }}
                          onClick={() => { clearSearch(); handlePillClick(cat._id); }}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium border border-slate-200 bg-white text-slate-700 shadow-sm hover:shadow-md transition-all"
                        >
                          <span className="opacity-50">{getCategoryIcon(cat.name, 'w-3.5 h-3.5')}</span>
                          {cat.name}
                        </motion.button>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <EmptyMenuIllustration themeColor={themeColor} size={150} />
                <h3 className="mt-4 text-lg font-bold text-gray-700">
                  Menú vacío
                </h3>
                <p className="mt-1.5 text-sm text-gray-500 max-w-xs">
                  Aún no hay productos disponibles en esta categoría.
                </p>
              </>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
          {activeCategory === 'all' ? (
              // Group products by category
              categoriesWithProducts.map((category, categoryIndex) => {
              const categoryProducts = filteredProducts.filter(product => product.category === category._id);
              if (categoryProducts.length === 0) return null;
              
              return (
                  <motion.div
                    key={category._id}
                    ref={el => (sectionRefs.current[category._id] = el)}
                    data-category-id={category._id}
                    className="mb-6 sm:mb-8"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: categoryIndex * 0.06 }}
                  >
                    {/* Category Header */}
                    <div className="flex items-center gap-2.5 mb-3 sm:mb-4">
                      <div 
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${themeColor}12`, color: themeColor }}
                      >
                        {getCategoryIcon(category.name, 'w-4 h-4 sm:w-[18px] sm:h-[18px]')}
                      </div>
                      <h2 className="text-[15px] sm:text-base font-bold text-slate-800 tracking-tight">{category.name}</h2>
                      <span className="text-[11px] text-slate-400 font-medium">{categoryProducts.length}</span>
                      <div 
                        className="flex-1 h-px"
                        style={{
                          background: `linear-gradient(to right, ${themeColor}20, transparent)`
                        }}
                      />
                    </div>
                    <motion.div 
                      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4"
                      variants={containerVariants}
                      initial="hidden"
                      animate="visible"
                    >
                      {categoryProducts.map((product, productIndex) => {
                        const isFirstHero = productIndex === 0 && categoryProducts.length > 2 && product.image;
                        return isFirstHero ? (
                          <div key={product._id} className="col-span-2">
                            <ProductCard
                              product={product}
                              addToCart={addToCart}
                              onToppingsOpen={onToppingsOpen}
                              onToppingsClose={onToppingsClose}
                              subscriptionStatus={subscriptionStatus}
                              isHero
                            />
                          </div>
                        ) : (
                          <ProductCard
                            key={product._id}
                            product={product}
                            addToCart={addToCart}
                            onToppingsOpen={onToppingsOpen}
                            onToppingsClose={onToppingsClose}
                            subscriptionStatus={subscriptionStatus}
                          />
                        );
                      })}
                    </motion.div>
                  </motion.div>
              );
            })
          ) : (
              // Specific category selected
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
              >
                {/* Category Header */}
                {categoriesWithProducts.filter(category => category._id === activeCategory).map(category => (
                  <div 
                    key={category._id}
                    className="flex items-center gap-2.5 mb-3 sm:mb-4"
                  >
                    <div 
                      className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: `${themeColor}12`, color: themeColor }}
                    >
                      {getCategoryIcon(category.name, 'w-[18px] h-[18px] sm:w-5 sm:h-5')}
                    </div>
                    <h2 className="text-base sm:text-lg font-bold text-slate-800 tracking-tight">{category.name}</h2>
                    <div 
                      className="flex-1 h-px"
                      style={{
                        background: `linear-gradient(to right, ${themeColor}20, transparent)`
                      }}
                    />
                  </div>
                ))}
                
                <motion.div 
                  className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                >
                  {filteredProducts.map((product, productIndex) => {
                    const isFirstHero = productIndex === 0 && filteredProducts.length > 2 && product.image;
                    return isFirstHero ? (
                      <div key={product._id} className="col-span-2">
                        <ProductCard
                          product={product}
                          addToCart={addToCart}
                          onToppingsOpen={onToppingsOpen}
                          onToppingsClose={onToppingsClose}
                          subscriptionStatus={subscriptionStatus}
                          isHero
                        />
                      </div>
                    ) : (
                      <ProductCard
                        key={product._id}
                        product={product}
                        addToCart={addToCart}
                        onToppingsOpen={onToppingsOpen}
                        onToppingsClose={onToppingsClose}
                        subscriptionStatus={subscriptionStatus}
                      />
                    );
                  })}
                </motion.div>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toppings Selector Modal */}
      {showToppings && selectedProduct && (
          <ProductToppingsSelector
          product={selectedProduct}
            onAddToCart={handleAddToCartWithToppings}
            onClose={handleCloseToppings}
          />
      )}
    </div>
  );
};

export default FilterableMenu; 
