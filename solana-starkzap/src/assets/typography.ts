const TYPOGRAPHY = {
  fontFamily: 'Roboto_400Regular',
  fontFamilyMedium: 'Roboto_500Medium',
  fontFamilyBold: 'Roboto_700Bold',

  regular: 400,
  medium: 500,
  semiBold: 600,
  bold: 700,

  size: {
    xs: 12,
    sm: 14,
    md: 15,
    lg: 16,
    xl: 18,
    xxl: 24,
    xxxl: 32,
    heading: 38,
  },

  lineHeight: {
    xs: 18,
    sm: 21,
    md: 23,
    lg: 24,
    xl: 27,
    xxl: 36,
    xxxl: 48,
    heading: 63,
  },

  letterSpacing: -0.011,

  fontWeightType: 'normal' as FontWeight,

  fontWeightToString: (weight: number): FontWeight => {
    return String(weight) as FontWeight;
  },

  get weights() {
    return {
      regular: this.fontWeightToString(this.regular),
      medium: this.fontWeightToString(this.medium),
      semiBold: this.fontWeightToString(this.semiBold),
      bold: this.fontWeightToString(this.bold),
    };
  },
};

type FontWeight =
  | 'normal'
  | 'bold'
  | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900'
  | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

export default TYPOGRAPHY;
