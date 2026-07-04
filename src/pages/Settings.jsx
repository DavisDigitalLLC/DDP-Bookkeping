import ChartOfAccounts from '../components/ChartOfAccounts';
import ProductLines from '../components/ProductLines';
import ProfileSettings from '../components/ProfileSettings';

export default function Settings() {
  return (
    <div>
      <h2>Settings</h2>

      <ProfileSettings />
      <ProductLines />
      <ChartOfAccounts />
    </div>
  );
}
