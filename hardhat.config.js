require("@nomicfoundation/hardhat-toolbox");
require("@openzeppelin/hardhat-upgrades");
require("hardhat-gas-reporter");

require("dotenv").config({ path: __dirname + "/.env" });

// The next line is part of the sample project, you don't need it in your
// project. It imports a Hardhat task definition, that can be used for
// testing the frontend.
// require('./tasks/faucet');
// require('@nomicfoundation/hardhat-verify');

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  defaultNetwork: "hardhat",
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_KEY,
      arbitrumSepolia: process.env.ARBISCAN_KEY,
      arbitrumMainnet: process.env.ARBISCAN_KEY,
      bscTestnet: process.env.BSCSCAN_KEY,
      bscMainnet: process.env.BSCSCAN_KEY,
    },
  },

  sourcify: {
    // Disabled by default
    // Doesn't need an API key
    enabled: false,
  },

  networks: {
    mainnet: {
      url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: [process.env.DEVNET_PRIVKEY],
    },
    sepolia: {
      url: `https://sepolia.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: [process.env.DEVNET_PRIVKEY],
    },
    goerli: {
      url: `https://goerli.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: [process.env.DEVNET_PRIVKEY],
    },

    arbitrum_mainnet: {
      url: `https://arbitrum-mainnet.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: [process.env.DEVNET_PRIVKEY],
    },
    arbitrum_sepolia: {
      url: `https://arbitrum-sepolia.infura.io/v3/${process.env.INFURA_KEY}`,
      accounts: [process.env.DEVNET_PRIVKEY],
    },

    bsc_mainnet: {
      url: "https://bsc-dataseed.bnbchain.org/",
      chainId: 56,
      gasPrice: 20000000000,
      accounts: [process.env.DEVNET_PRIVKEY],
    },
    bsc_testnet: {
      url: "https://data-seed-prebsc-1-s1.bnbchain.org:8545",
      chainId: 97,
      gasPrice: 20000000000,
      accounts: [process.env.DEVNET_PRIVKEY],
    },
  },
  solidity: "0.8.22",
  gasReporter: {
    enabled: true,
    outputFile: "gas-reporter.txt",
    noColors: true,
  },
};
