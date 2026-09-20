import styled from 'styled-components';

export const Button = styled.button`
  background: ${(p) => p.theme.colors.primary};
  padding: ${(p) => p.theme.space[2]};
  border-radius: ${(p) => p.theme.radii.md};
`;
