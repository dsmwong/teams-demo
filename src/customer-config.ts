export interface CustomerConfig {
  name:            string;
  mobile:          string;
  accountType:     string;
  accountLastFour: string;
}

let _config: CustomerConfig = {
  name: '', mobile: '', accountType: '', accountLastFour: '',
};

export const getCustomerConfig = (): CustomerConfig => ({ ..._config });
export const setCustomerConfig = (c: Partial<CustomerConfig>): void => {
  _config = { ..._config, ...c };
};
