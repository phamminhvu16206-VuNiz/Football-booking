const assert = require('node:assert/strict');
const { afterEach, test } = require('node:test');
const Field = require('../models/Field');
const { getFields } = require('../controllers/fieldController');

const originalCountDocuments = Field.countDocuments;
const originalFind = Field.find;

afterEach(() => {
    Field.countDocuments = originalCountDocuments;
    Field.find = originalFind;
});

const runListRequest = async (query) => {
    let searchedWith;
    let sortedWith;
    let skippedBy;
    let limitedTo;

    Field.countDocuments = async (filter) => {
        searchedWith = filter;
        return 0;
    };
    Field.find = (filter) => {
        searchedWith = filter;
        return {
            sort(sort) {
                sortedWith = sort;
                return this;
            },
            skip(skip) {
                skippedBy = skip;
                return this;
            },
            limit(limit) {
                limitedTo = limit;
                return Promise.resolve([]);
            },
        };
    };

    const response = {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
    };
    await getFields({ query }, response);
    return { response, searchedWith, sortedWith, skippedBy, limitedTo };
};

test('filters by field type and keyword while sorting prices low to high', async () => {
    const result = await runListRequest({
        keyword: 'sân mini',
        type: '5 người',
        status: 'AVAILABLE',
        sort: 'price_asc',
        page: '2',
        limit: '5',
    });

    assert.deepEqual(result.searchedWith, {
        name: { $regex: 'sân mini', $options: 'i' },
        type: '5 người',
        status: 'AVAILABLE',
    });
    assert.deepEqual(result.sortedWith, { price: 1, _id: 1 });
    assert.equal(result.skippedBy, 5);
    assert.equal(result.limitedTo, 5);
});

test('sorts prices high to low and keeps equal-price results stable', async () => {
    const result = await runListRequest({ sort: 'price_desc' });

    assert.deepEqual(result.sortedWith, { price: -1, _id: 1 });
});

test('defaults to newest-first for unsupported sort options', async () => {
    const result = await runListRequest({ sort: 'unknown' });

    assert.deepEqual(result.sortedWith, { createdAt: -1 });
});
