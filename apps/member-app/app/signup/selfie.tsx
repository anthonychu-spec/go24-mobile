import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../../src/theme/colors';
import { fonts } from '../../src/theme/fonts';
import { useSignup } from './_layout';

export default function SignupStep3() {
  const router = useRouter();
  const { data, update } = useSignup();
  const [photo, setPhoto] = useState<string>(data.facePhotoB64);
  const [error, setError] = useState('');

  const takePhoto = async () => {
    setError('');
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { setError('Camera permission is required'); return; }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7,
      base64: true, cameraType: ImagePicker.CameraType.front,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setPhoto(result.assets[0].base64);
    }
  };

  const pickFromLibrary = async () => {
    setError('');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [1, 1], quality: 0.7, base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      setPhoto(result.assets[0].base64);
    }
  };

  const next = () => {
    if (!photo) { setError('Please take a selfie first'); return; }
    update({ facePhotoB64: photo });
    router.push('/signup/payment');
  };

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.scroll}>
        <View style={s.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={12}><Text style={s.back}>← Back</Text></Pressable>
          <Text style={s.step}>Step 3 of 4</Text>
        </View>

        <Text style={s.title}>Face ID Setup</Text>
        <Text style={s.sub}>Take a clear selfie for gym entry recognition</Text>

        {/* Photo preview */}
        <Pressable style={s.photoCircle} onPress={takePhoto}>
          {photo ? (
            <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={s.photo} />
          ) : (
            <View style={s.photoEmpty}>
              <Ionicons name="camera-outline" size={48} color={colors.textMuted} />
              <Text style={s.photoHint}>Tap to take selfie</Text>
            </View>
          )}
        </Pressable>

        <View style={s.actions}>
          <Pressable style={s.actionBtn} onPress={takePhoto}>
            <Ionicons name="camera-outline" size={18} color={colors.primary} />
            <Text style={s.actionBtnTxt}>Camera</Text>
          </Pressable>
          <Pressable style={s.actionBtn} onPress={pickFromLibrary}>
            <Ionicons name="image-outline" size={18} color={colors.primary} />
            <Text style={s.actionBtnTxt}>Gallery</Text>
          </Pressable>
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        <View style={s.tips}>
          <Text style={s.tipsTitle}>Tips for best results:</Text>
          {['Face the camera directly', 'Good lighting, no glasses', 'Plain background'].map(tip => (
            <View key={tip} style={s.tipRow}>
              <Ionicons name="checkmark-circle" size={14} color={colors.success} />
              <Text style={s.tipTxt}>{tip}</Text>
            </View>
          ))}
        </View>

        <Pressable style={[s.btn, !photo && s.btnOff]} onPress={next} disabled={!photo}>
          <Text style={s.btnTxt}>Next: Payment →</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe:        { flex: 1, backgroundColor: colors.bg },
  scroll:      { flex: 1, padding: 20 },
  topRow:      { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  back:        { fontSize: 14, color: colors.primary, fontFamily: fonts.semibold },
  step:        { fontSize: 12, color: colors.textMuted },
  title:       { fontSize: 26, fontFamily: fonts.black, color: colors.text, marginBottom: 4 },
  sub:         { fontSize: 14, color: colors.textMuted, marginBottom: 24 },
  photoCircle: { width: 180, height: 180, borderRadius: 90, alignSelf: 'center', overflow: 'hidden', marginBottom: 20 },
  photo:       { width: '100%', height: '100%' },
  photoEmpty:  {
    flex: 1, backgroundColor: colors.card,
    borderWidth: 2, borderColor: colors.border, borderStyle: 'dashed', borderRadius: 90,
    alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  photoHint:   { fontSize: 12, color: colors.textMuted },
  actions:     { flexDirection: 'row', gap: 10, marginBottom: 16 },
  actionBtn:   {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: colors.primaryBg, borderRadius: 12, paddingVertical: 12,
  },
  actionBtnTxt:{ fontSize: 14, color: colors.primary, fontFamily: fonts.semibold },
  error:       { fontSize: 13, color: colors.error, textAlign: 'center', marginBottom: 12 },
  tips:        { backgroundColor: colors.card, borderRadius: 14, padding: 16, gap: 8, marginBottom: 24 },
  tipsTitle:   { fontSize: 13, fontFamily: fonts.bold, color: colors.text, marginBottom: 4 },
  tipRow:      { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipTxt:      { fontSize: 13, color: colors.textMuted },
  btn:         { backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center' },
  btnOff:      { opacity: 0.4 },
  btnTxt:      { fontSize: 16, fontFamily: fonts.bold, color: '#fff' },
});
