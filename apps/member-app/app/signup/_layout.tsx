import { createContext, useContext, useState } from 'react';
import { Stack } from 'expo-router';
import { colors } from '../../src/theme/colors';

export interface SignupData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth: string;
  planId: number;
  planName: string;
  planPriceHkd: number;
  facePhotoB64: string;
}

const defaultData: SignupData = {
  firstName: '', lastName: '', email: '', phone: '', dateOfBirth: '',
  planId: 0, planName: '', planPriceHkd: 0, facePhotoB64: '',
};

interface SignupCtx { data: SignupData; update: (patch: Partial<SignupData>) => void }
const Ctx = createContext<SignupCtx>({ data: defaultData, update: () => {} });
export const useSignup = () => useContext(Ctx);

export default function SignupLayout() {
  const [data, setData] = useState<SignupData>(defaultData);
  const update = (patch: Partial<SignupData>) => setData(d => ({ ...d, ...patch }));

  return (
    <Ctx.Provider value={{ data, update }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }} />
    </Ctx.Provider>
  );
}
