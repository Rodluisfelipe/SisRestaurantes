module.exports = {
  ...require('./handleErrors'),
  ...require('./orderValidators'),
  ...require('./customerValidators'),
  ...require('./bookingValidators'),
  ...require('./businessConfigValidators'),
  ...require('./productValidators'),
  ...require('./categoryValidators'),
  ...require('./tableValidators'),
  ...require('./loyaltyValidators'),
  ...require('./reviewValidators'),
};
