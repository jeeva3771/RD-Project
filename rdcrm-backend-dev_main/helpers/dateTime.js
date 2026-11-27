import moment from 'moment-timezone';

export const getCurrentDate = () => {
  return moment().tz("Asia/Kolkata").format('DD-MM-YYYY HH:mm:ss');
};


