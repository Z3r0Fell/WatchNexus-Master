---
name: react-patterns
description: Use when writing or modifying React 19 frontend code. Covers project-specific component patterns, Radix UI conventions, Tailwind class usage, and code splitting.
---

# React Patterns for WatchNexus

## Project-Specific Conventions

### Page Component Template
```jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';

function FeaturePage() {
    const { user } = useAuth();
    const [data, setData] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get('/endpoint')
            .then(res => setData(res.data))
            .catch(err => console.error(err))
            .finally(() => setLoading(false));
    }, []);

    if (loading) return <div className="flex justify-center p-8"><Spinner /></div>;

    return (
        <div className="container mx-auto p-4 space-y-4">
            <h1 className="text-2xl font-bold">Feature Name</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {data.map(item => (
                    <FeatureCard key={item.id} item={item} />
                ))}
            </div>
        </div>
    );
}

export default FeaturePage;
```

### cn() Utility Usage
```jsx
// src/lib/utils.js
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs) { return twMerge(clsx(inputs)); }

// Usage
<div className={cn('base-class', isActive && 'active-class', className)} />
```

### Radix UI + Tailwind Pattern
```jsx
import * as Dialog from '@radix-ui/react-dialog';

function ConfirmDialog({ open, onOpenChange, title, children, onConfirm }) {
    return (
        <Dialog.Root open={open} onOpenChange={onOpenChange}>
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/50 data-[state=open]:animate-in" />
                <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-gray-800 rounded-lg p-6 shadow-xl">
                    <Dialog.Title className="text-lg font-semibold">{title}</Dialog.Title>
                    {children}
                    <div className="flex justify-end gap-2 mt-4">
                        <Dialog.Close asChild>
                            <Button variant="ghost">Cancel</Button>
                        </Dialog.Close>
                        <Button onClick={onConfirm}>Confirm</Button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}
```

### Context Provider Pattern
```jsx
const FeatureContext = createContext();

export function FeatureProvider({ children }) {
    const [state, dispatch] = useReducer(featureReducer, initialState);
    const value = useMemo(() => ({ state, dispatch }), [state]);
    return <FeatureContext.Provider value={value}>{children}</FeatureContext.Provider>;
}

export const useFeature = () => {
    const ctx = useContext(FeatureContext);
    if (!ctx) throw new Error('useFeature must be used within FeatureProvider');
    return ctx;
};
```

### Code Splitting
```jsx
const HeavyPage = React.lazy(() => import('./pages/HeavyPage'));

// In router
<Route path="/heavy" element={
    <Suspense fallback={<PageSkeleton />}>
        <HeavyPage />
    </Suspense>
} />
```

### Error Boundary
```jsx
class ErrorBoundary extends React.Component {
    state = { hasError: false, error: null };
    static getDerivedStateFromError(error) { return { hasError: true, error }; }
    render() {
        if (this.state.hasError) return <ErrorFallback error={this.state.error} />;
        return this.props.children;
    }
}
```

## Tailwind Class Patterns (from config)
Check `tailwind.config.js` for custom theme values (colors, spacing, fonts) before hardcoding values.
