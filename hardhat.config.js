require('@nomicfoundation/hardhat-toolbox');
require('@openzeppelin/hardhat-upgrades');
require('hardhat-gas-reporter');

require('dotenv').config({ path: __dirname + '/.env' });

// The next line is part of the sample project, you don't need it in your
// project. It imports a Hardhat task definition, that can be used for
// testing the frontend.
// require('./tasks/faucet');
// require('@nomicfoundation/hardhat-verify');

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: 'hardhat',
  etherscan: {
    //apiKey: process.env.ARBISCAN_KEY,
    apiKey: process.env.ETHERSCAN_KEY,
  },

  sourcify: {
    // Disabled by default
    // Doesn't need an API key
    enabled: false,
  },

  networks: {
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: [process.env.DEVNET_PRIVKEY],
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: [process.env.DEVNET_PRIVKEY],
    },
    arbitrumGoerli: {
      url: `https://arbitrum-goerli.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: [process.env.DEVNET_PRIVKEY],
    },
    bsc_testnet: {
      url: 'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
      chainId: 97,
      gasPrice: 20000000000,
      accounts: [process.env.DEVNET_PRIVKEY],
    },
    bsc_mainnet: {
      url: 'https://bsc-dataseed.bnbchain.org/',
      chainId: 56,
      gasPrice: 20000000000,
      accounts: [process.env.DEVNET_PRIVKEY],
    },
  },
  solidity: '0.8.22',
  gasReporter: {
    enabled: true,
    outputFile: 'gas-reporter.txt',
    noColors: true,
  },
};
