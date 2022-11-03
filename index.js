const BLOCK_HEIGHT = 680000;
const axios = require('axios');
const BASE_URL = 'https://blockstream.info/api/';
const fs = require('fs');

//Function to get the block hash from it's height
const getBlockHash = (block_height) => {
    let url = BASE_URL + `/block-height/${block_height}`;
    return axios({ method: 'get', url })
        .then(blockHashRes => {
            console.log('Block Hash: ', blockHashRes.data)
            return blockHashRes.data;
        })
        .catch(err => {
            console.error('Error in Fetching block hash : ', err);
            throw err;
        })
}

//Function to fetch all the transactionf for block hash and save it in JSON file
const getAllTransactions = (block_hash) => {
    let blockUrl = BASE_URL + `/block/${block_hash}`;
    let totalTransactions = 0;
    //Fetching block details to get total count
    return axios({ method: 'get', url: blockUrl })
        .then(blockRes => {
            if (blockRes.data.tx_count)
                totalTransactions = blockRes.data.tx_count;
            if (totalTransactions > 0) {
                let transactions = [];
                //creating starting point for fetching the transactons in pagination manner
                let batches = createBatches(totalTransactions);
                console.log("Batch Length: ", batches.length);
                return batches.reduce((promise, batch) => {
                    return promise.then(() => {
                        let blockTransactionUrl = BASE_URL + `/block/${block_hash}/txs/${batch}`;
                        return axios({ method: 'get', url: blockTransactionUrl })
                            .then(transactionsRes => {
                                transactions = [...transactions, ...transactionsRes.data];
                                return transactions;
                            })
                            .catch(err => {
                                throw err;
                            })
                    })
                }, Promise.resolve());
            } else return [];
        })
        .then(transactions => {
            if (transactions.length) {
                let json = JSON.stringify(transactions);
                fs.writeFileSync('transactions.json', json, 'utf8');
                console.log('JSON file created');
            }
        })
        .catch(err => {
            console.error('Error in Fetching All transactions : ', err);
            throw err;
        })
}

//function to create batch
const createBatches = (totalTransactions) => {
    let batchSize = 25;
    let batches = [];
    let index = 0
    if (totalTransactions < batchSize) batches.push(index);
    else {
        while (totalTransactions > 0) {
            batches.push(index);
            index += batchSize;
            totalTransactions -= batchSize;
        }
    }
    return batches;
}

//function calling blockhash function and creating json file from transactions can be called once
const createTransactionJSON = () => {
    getBlockHash(BLOCK_HEIGHT)
        .then(blockHash => {
            return getAllTransactions(blockHash);
        })
        .then(() => {
            console.log('Done');
        })
        .catch(err => {
            console.error('Error in craeting JSON file : ', err);
        })
}

//main function calculating the direct and indirect parents
const initiate = () => {
    console.log('Initiated');
    fs.readFile('transactions.json', 'utf-8', (err, data) => {
        if (err) {
            console.error('Error in reading JSON file:', err);
        } else {
            let transactions = JSON.parse(data);
            let directParents = {};
            let transactionsIds = [];
            for (let i = 1; i < transactions.length; i++) {
                transactionsIds.push(transactions[i].txid);
                directParents[transactions[i].txid] = [];
                for (let j = 0; j < transactions[i].vin.length; j++) {
                    directParents[transactions[i].txid].push(transactions[i].vin[j].txid);
                }
            }
            console.log('Direct Parents calculated');
            console.log('Processing each transaction for indirect parents');

            let parentCount = {};
            for (let i = 0; i < transactionsIds.length; i++) {
                let itemsToProcess = [];
                let transactionId = transactionsIds[i];
                let parentSet = new Set();
                parentSet.add(transactionId);
                parentCount[transactionId] = 0;
                itemsToProcess.push(transactionId);
                while (itemsToProcess.length) {
                    let item = itemsToProcess.shift();
                    if (directParents[item]) {
                        parentCount[transactionId] += directParents[item].length;
                        for (let j = 0; j < directParents[item].length; j++) {
                            if (!parentSet.has(directParents[item][j])) {
                                itemsToProcess.push(directParents[item][j]);
                                parentSet.add(directParents[item][j]);
                            }

                        }
                    }

                    //break;

                }
            }
            let sortable = [];
            for (var txnId in parentCount) {
                sortable.push([txnId, parentCount[txnId]]);
            }

            sortable.sort(function (a, b) {
                return b[1] - a[1];
            });
            for (let i = 0; i < 10; i++) {
                console.log(`Transaction id ${i + 1} :`, sortable[i][0]);
            }
        }
    })
}

initiate();