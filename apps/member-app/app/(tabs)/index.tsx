import { brand } from '../../src/brand';
import ClassicHome from '../../src/screens/classic/HomeScreen';
import MemberHome from '../../src/screens/member/HomeScreen';

// Home differs by brand layout; the other tabs are separate routes.
export default brand.layout === 'member' ? MemberHome : ClassicHome;
