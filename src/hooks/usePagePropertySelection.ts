import { useEffect, useMemo, useState } from 'react';
import type { Property } from '@/data/seedData';

type UserPropertyContext = {
  propertyId?: string | null;
  role?: string | null;
};

type UsePagePropertySelectionOptions = {
  allowAllProperties?: boolean;
  currentUser?: UserPropertyContext | null;
  properties: Pick<Property, 'id'>[];
};

export function toConcretePropertyId(propertyId?: string | null) {
  return propertyId && propertyId !== 'all' ? propertyId : undefined;
}

function getDefaultPropertyId({
  allowAllProperties = true,
  currentUser,
  properties,
}: UsePagePropertySelectionOptions) {
  const userPropertyId = currentUser?.propertyId ?? null;
  const hasUserProperty = Boolean(userPropertyId && properties.some((property) => property.id === userPropertyId));
  const role = String(currentUser?.role ?? '').toLowerCase();

  if ((role === 'employee' || role === 'viewer') && hasUserProperty) {
    return userPropertyId!;
  }

  if (allowAllProperties) return 'all';
  return properties[0]?.id ?? '';
}

export function usePagePropertySelection({
  allowAllProperties = true,
  currentUser,
  properties,
}: UsePagePropertySelectionOptions) {
  const defaultPropertyId = useMemo(
    () => getDefaultPropertyId({ allowAllProperties, currentUser, properties }),
    [allowAllProperties, currentUser?.propertyId, currentUser?.role, properties],
  );
  const [selectedPropertyId, setSelectedPropertyId] = useState(defaultPropertyId);

  useEffect(() => {
    setSelectedPropertyId((current) => {
      if (current === 'all' && allowAllProperties) return current;
      if (current && properties.some((property) => property.id === current)) return current;
      return defaultPropertyId;
    });
  }, [allowAllProperties, defaultPropertyId, properties]);

  return [selectedPropertyId, setSelectedPropertyId] as const;
}
