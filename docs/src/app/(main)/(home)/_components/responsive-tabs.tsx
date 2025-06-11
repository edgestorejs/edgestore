'use client';

import { cn } from '@/lib/utils';
import * as React from 'react';
import { useEffect, useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs';

// Context for managing responsive tabs state
interface ResponsiveTabsContextValue {
  activeTab: string;
  setActiveTab: (value: string) => void;
  isMobile: boolean;
  tabs: { value: string; label: React.ReactNode; disabled?: boolean }[];
  setTabs: React.Dispatch<
    React.SetStateAction<
      { value: string; label: React.ReactNode; disabled?: boolean }[]
    >
  >;
}

const ResponsiveTabsContext =
  React.createContext<ResponsiveTabsContextValue | null>(null);

function useResponsiveTabs() {
  const context = React.useContext(ResponsiveTabsContext);
  if (!context) {
    throw new Error(
      'useResponsiveTabs must be used within ResponsiveTabsProvider',
    );
  }
  return context;
}

// Hook to detect mobile screen size
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkIsMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };

    checkIsMobile();
    window.addEventListener('resize', checkIsMobile);
    return () => {
      window.removeEventListener('resize', checkIsMobile);
    };
  }, []);

  return isMobile;
}

// Provider component
interface ResponsiveTabsProps {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  children: React.ReactNode;
  className?: string;
}

function ResponsiveTabs({
  defaultValue,
  value: controlledValue,
  onValueChange,
  children,
  className,
}: ResponsiveTabsProps) {
  const isMobile = useIsMobile();
  const [internalValue, setInternalValue] = useState(defaultValue || '');
  const [tabs, setTabs] = useState<
    { value: string; label: React.ReactNode; disabled?: boolean }[]
  >([]);

  const activeTab =
    controlledValue !== undefined ? controlledValue : internalValue;

  const setActiveTab = (newValue: string) => {
    if (controlledValue === undefined) {
      setInternalValue(newValue);
    }
    onValueChange?.(newValue);
  };

  const contextValue: ResponsiveTabsContextValue = {
    activeTab,
    setActiveTab,
    isMobile,
    tabs,
    setTabs,
  };

  return (
    <ResponsiveTabsContext.Provider value={contextValue}>
      <div className={cn('w-full', className)}>
        {isMobile ? (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {children}
          </Tabs>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {children}
          </Tabs>
        )}
      </div>
    </ResponsiveTabsContext.Provider>
  );
}

// Responsive TabsList that renders as Select on mobile, TabsList on desktop
interface ResponsiveTabsListProps {
  className?: string;
  children: React.ReactNode;
}

function ResponsiveTabsList({ className, children }: ResponsiveTabsListProps) {
  const { isMobile, activeTab, setActiveTab, tabs, setTabs } =
    useResponsiveTabs();

  // Extract tab information from children
  useEffect(() => {
    const tabInfo: {
      value: string;
      label: React.ReactNode;
      disabled?: boolean;
    }[] = [];

    React.Children.forEach(children, (child) => {
      if (
        React.isValidElement(child) &&
        typeof child.props === 'object' &&
        child.props !== null &&
        'value' in child.props &&
        typeof child.props.value === 'string'
      ) {
        tabInfo.push({
          value: child.props.value,
          label:
            'children' in child.props
              ? (child.props.children as React.ReactNode)
              : null,
          disabled:
            'disabled' in child.props
              ? (child.props.disabled as boolean | undefined)
              : undefined,
        });
      }
    });

    if (tabs.length === 0 && tabInfo.length > 0) {
      setTabs(tabInfo);
    }
  }, [children, tabs.length, setTabs]);

  if (isMobile) {
    const activeTabLabel = tabs.find((tab) => tab.value === activeTab)?.label;

    return (
      <div className={cn('mb-4', className)}>
        <Select value={activeTab} onValueChange={setActiveTab}>
          <SelectTrigger className="w-full">
            <SelectValue>{activeTabLabel || 'Select tab...'}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {tabs.map((tab) => (
              <SelectItem
                key={tab.value}
                value={tab.value}
                disabled={tab.disabled}
              >
                {tab.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return <TabsList className={className}>{children}</TabsList>;
}

// Responsive TabsTrigger (only used on desktop, hidden on mobile)
interface ResponsiveTabsTriggerProps {
  value: string;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

function ResponsiveTabsTrigger({
  value,
  disabled,
  className,
  children,
}: ResponsiveTabsTriggerProps) {
  const { isMobile } = useResponsiveTabs();

  // On mobile, this component doesn't render anything as the select handles the triggers
  if (isMobile) {
    return null;
  }

  return (
    <TabsTrigger value={value} disabled={disabled} className={className}>
      {children}
    </TabsTrigger>
  );
}

// Responsive TabsContent (works the same on both mobile and desktop)
interface ResponsiveTabsContentProps {
  value: string;
  className?: string;
  children: React.ReactNode;
}

function ResponsiveTabsContent({
  value,
  className,
  children,
}: ResponsiveTabsContentProps) {
  return (
    <TabsContent value={value} className={className}>
      {children}
    </TabsContent>
  );
}

export {
  ResponsiveTabs,
  ResponsiveTabsList,
  ResponsiveTabsTrigger,
  ResponsiveTabsContent,
  useResponsiveTabs,
};
