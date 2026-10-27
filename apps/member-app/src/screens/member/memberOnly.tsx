import type { ComponentType } from 'react';
import { Redirect } from 'expo-router';
import { brand } from '../../brand';

/** Member-layout routes exist for every brand (file routing); classic brands are sent home. */
export function memberOnly<P extends object>(Screen: ComponentType<P>): ComponentType<P> {
  if (brand.layout === 'member') return Screen;
  return function ClassicRedirect() {
    return <Redirect href="/(tabs)" />;
  };
}
