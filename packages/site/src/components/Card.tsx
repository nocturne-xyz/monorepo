import { ReactNode } from "react";
import styled from "styled-components";

type CardProps = {
  content: {
    title: string;
    description: string;
  };
  children: ReactNode;
  disabled?: boolean;
  fullWidth?: boolean;
};

const CardWrapper = styled.div<{ fullWidth?: boolean; disabled: boolean }>`
  overflow: auto;
  display: flex;
  flex-direction: column;
  width: ${({ fullWidth }) => (fullWidth ? "100%" : "250px")};
  margin-top: 2.4rem;
  margin-bottom: 2.4rem;
  padding: 2.4rem;
  border: 1px solid ${({ theme }) => theme.colors.border.default};
  border-radius: ${({ theme }) => theme.radii.default};
  box-shadow: ${({ theme }) => theme.shadows.default};
  filter: opacity(${({ disabled }) => (disabled ? ".4" : "1")});
  align-self: stretch;
  ${({ theme }) => theme.mediaQueries.small} {
    width: 100%;
    margin-top: 1.2rem;
    margin-bottom: 1.2rem;
    padding: 1.6rem;
  }
`;

const CardBackground = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  filter: blur(4px);
  background-color: rgba(255, 255, 255, 0.1);
  z-index: -1;
`;

const Title = styled.h2`
  font-size: ${({ theme }) => theme.fontSizes.large};
  margin: 0;
  ${({ theme }) => theme.mediaQueries.small} {
    font-size: ${({ theme }) => theme.fontSizes.text};
  }
`;

const Description = styled.p`
  margin-top: 2.4rem;
  margin-bottom: 2.4rem;
`;

export const Card = ({
  content,
  disabled = false,
  fullWidth,
  children,
}: CardProps) => {
  const { title, description } = content;
  return (
    <CardWrapper fullWidth={fullWidth} disabled={disabled}>
      <CardBackground />
      <Title>{title}</Title>
      <Description>{description}</Description>
      {children}
    </CardWrapper>
  );
};
