import { Heading, Text } from '@react-email/components';
import { EmailLayout } from './_layout';

interface Props {
  brandName: string;
  cycleName: string;
  itemCount: number;
}

const heading = { fontSize: '20px', fontWeight: 500, color: '#1a1a1a', margin: '0 0 16px' };
const para = { fontSize: '14px', lineHeight: 1.65, color: '#444', margin: '0 0 12px' };

export function OnboardingConfirmation({ brandName, cycleName, itemCount }: Props) {
  return (
    <EmailLayout preview={`Tibi — onboarding received for ${brandName}`}>
      <Heading style={heading}>Welcome to Tibi, {brandName}.</Heading>
      <Text style={para}>
        We've received your onboarding submission for <strong>{cycleName}</strong> — {itemCount}{' '}
        {itemCount === 1 ? 'item' : 'items'} listed.
      </Text>
      <Text style={para}>
        Tibi will confirm received quantities at physical receipt, then share your private dashboard link.
        Your commission will be confirmed at that point.
      </Text>
      <Text style={para}>
        If you need to reach us in the meantime, this address is the fastest path.
      </Text>
    </EmailLayout>
  );
}

export default OnboardingConfirmation;
