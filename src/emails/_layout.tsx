import { Body, Container, Head, Hr, Html, Preview, Section, Text } from '@react-email/components';
import type { ReactNode } from 'react';

interface Props {
  preview: string;
  children: ReactNode;
}

const main = {
  backgroundColor: '#ffffff',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  color: '#1a1a1a',
};

const container = {
  margin: '0 auto',
  padding: '40px 24px',
  maxWidth: '560px',
};

const wordmark = {
  fontSize: '13px',
  fontWeight: 500,
  letterSpacing: '0.18em',
  textAlign: 'center' as const,
  color: '#1a1a1a',
  margin: '0 0 32px',
};

const footer = {
  fontSize: '11px',
  color: '#bbbbbb',
  textAlign: 'center' as const,
  marginTop: '40px',
};

const hr = {
  borderTop: '1px solid #e5e5e5',
  margin: '32px 0',
};

export function EmailLayout({ preview, children }: Props) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Text style={wordmark}>TIBI</Text>
          <Section>{children}</Section>
          <Hr style={hr} />
          <Text style={footer}>hello@ismathlauriano.com · Cotonou, Bénin</Text>
        </Container>
      </Body>
    </Html>
  );
}
