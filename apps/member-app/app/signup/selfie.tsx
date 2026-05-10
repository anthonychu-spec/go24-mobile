import { useState } from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors, fonts, spacing, type as ty, radius } from '../../src/theme';
import { Button, Card, ScreenWrapper, ScreenHeader } from '../../src/components';
import { t } from '../../src/i18n';
import { useSignup } from './_layout';

export default function SignupStep3() {
  const router = useRouter();
  const { data, update } = useSignup();
  const [photo, setPhoto] = useState<string>(data.facePhotoB64);
  const [error, setError] = useState('');

  const takePhoto = async () => {
    setError('');
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { setError(t.signup.cameraPermRequired); return; }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7,
      base64: true, cameraType: ImagePicker.CameraType.front,
    });
    if (!result.canceled && result.assets[0]?.base64) setPhoto(result.assets[0].base64);
  };

  const pickFromLibrary = async () => {
    setError('');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) setPhoto(result.assets[0].base64);
  };

  const next = () => {
    if (!photo) { setError(t.signup.takeSelfieFirst); return; }
    update({ facePhotoB64: photo });
    router.push('/signup/payment');
  };

  return (
    <ScreenWrapper>
      <ScreenHeader showBack title={t.signup.step3Title} subtitle={t.signup.step3Sub}
        rightLabel="3/4" />

      <View style={s.content}>
        <Pressable style={s.photoCircle} onPress={takePhoto}>
          {photo ? (
            <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={s.photo} />
          ) : (
            <View style={s.photoEmpty}>
              <Ionicons name="camera-outline" size={48} color={colors.textMuted} />
              <Text style={s.photoHint}>{t.signup.tapToTakeSelfie}</Text>
            </View>
          )}
        </Pressable>

        <View style={s.actions}>
          <Pressable style={s.actionBtn} onPress={takePhoto}>
            <Ionicons name="camera-outline" size={18} color={colors.primary} />
            <Text style={s.actionTxt}>{t.signup.camera}</Text>
          </Pressable>
          <Pressable style={s.actionBtn} onPress={pickFromLibrary}>
            <Ionicons name="image-outline" size={18} color={colors.primary} />
            <Text style={s.actionTxt}>{t.signup.gallery}</Text>
          </Pressable>
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <Card style={s.tips}>
          <Text style={s.tipsTitle}>{t.signup.tipsTitle}</Text>
          {[t.signup.cameraTip1, t.signup.cameraTip2, t.signup.cameraTip3].map(tip => (
            <View key={tip} style={s.tipRow}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={s.tipTxt}>{tip}</Text>
            </View>
          ))}
        </Card>

        <Button label={t.signup.nextPayment} variant="primary" size="lg" fullWidth
          disabled={!photo} onPress={next} icon="arrow-forward" iconPosition="right" />
      </View>
    </ScreenWrapper>
  );
}

const s = StyleSheet.create({
  content:     { flex: 1, padding: spacing.xl },
  photoCircle: { width: 180, height: 180, borderRadius: 90, alignSelf: 'center', overflow: 'hidden', marginBottom: spacing.lg },
  photo:       { width: '100%', height: '100%' },
  photoEmpty:  {
    flex: 1, backgroundColor: colors.card,
    borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 90,
    alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  photoHint:   { ...ty.caption, color: colors.textMuted },
  actions:     { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.base },
  actionBtn:   {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
    backgroundColor: colors.primaryBg, borderRadius: radius.md, paddingVertical: spacing.md,
  },
  actionTxt:   { ...ty.body, color: colors.primary, fontFamily: fonts.semibold },
  error:       { ...ty.bodySm, color: colors.error, textAlign: 'center', marginBottom: spacing.md },
  tips:        { gap: spacing.sm, marginBottom: spacing.xl },
  tipsTitle:   { ...ty.label, color: colors.text, marginBottom: spacing.xs },
  tipRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tipTxt:      { ...ty.bodySm, color: colors.textMuted },
});
