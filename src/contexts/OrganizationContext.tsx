import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from './AuthContext';

type OrganizationState = {
  id?: string;
  name?: string;
  logoUrl?: string;
};

type OrganizationContextValue = {
  organization: OrganizationState;
  refreshOrganization: () => Promise<void>;
};

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

export const OrganizationProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, refetchUser } = useAuth();
  const [organization, setOrganization] = useState<OrganizationState>({});

  useEffect(() => {
    if (!user) {
      setOrganization({});
      return;
    }

    setOrganization({
      id: user.organizationId,
      name: user.organizationName || user.organization,
      logoUrl: user.organizationLogoUrl || user.organizationLogo,
    });
  }, [user]);

  const refreshOrganization = async () => {
    await refetchUser();
  };

  const value = useMemo(
    () => ({ organization, refreshOrganization }),
    [organization]
  );

  return (
    <OrganizationContext.Provider value={value}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};
