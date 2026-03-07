/**
 * AEM Commerce API Configuration
 */
export default {
  baseURL: 'https://www.aemshop.net/cs-graphql',
  apiKey: '4dfa19c9fe6f4cccade55cc5b3da94f7',
  
  headers: {
    'accept': 'application/json',
    'content-type': 'application/json',
    'x-api-key': '4dfa19c9fe6f4cccade55cc5b3da94f7',
    'magento-store-code': 'main_website_store',
    'magento-store-view-code': 'default',
    'magento-website-code': 'base',
    'magento-environment-id': 'f38a0de0-764b-41fa-bd2c-5bc2f3c7b39a',
    'magento-customer-group': 'b6589fc6ab0dc82cf12099d1c2d40ab994e8410c',
    'store': 'default'
  },
  
  defaultPageSize: 12,
  defaultCategory: 'apparel',
  
  queries: {
    productSearch: `
      query productSearch(
        $phrase: String!
        $pageSize: Int
        $currentPage: Int = 1
        $filter: [SearchClauseInput!]
        $sort: [ProductSearchSortInput!]
        $context: QueryContextInput
      ) {
        productSearch(
          phrase: $phrase
          page_size: $pageSize
          current_page: $currentPage
          filter: $filter
          sort: $sort
          context: $context
        ) {
          total_count
          items {
            productView {
              __typename
              sku
              name
              inStock
              url
              urlKey
              images {
                label
                url
                roles
              }
              ... on ComplexProductView {
                priceRange {
                  maximum {
                    final {
                      amount {
                        value
                        currency
                      }
                    }
                    regular {
                      amount {
                        value
                        currency
                      }
                    }
                  }
                  minimum {
                    final {
                      amount {
                        value
                        currency
                      }
                    }
                    regular {
                      amount {
                        value
                        currency
                      }
                    }
                  }
                }
                options {
                  id
                  title
                  values {
                    title
                    ... on ProductViewOptionValueSwatch {
                      id
                      inStock
                      type
                      value
                    }
                  }
                }
              }
              ... on SimpleProductView {
                price {
                  final {
                    amount {
                      value
                      currency
                    }
                  }
                  regular {
                    amount {
                      value
                      currency
                    }
                  }
                }
              }
            }
            highlights {
              attribute
              value
              matched_words
            }
          }
          facets {
            title
            attribute
            buckets {
              title
              __typename
              ... on CategoryView {
                name
                count
                path
              }
              ... on ScalarBucket {
                count
              }
              ... on RangeBucket {
                from
                to
                count
              }
              ... on StatsBucket {
                min
                max
              }
            }
          }
          page_info {
            current_page
            page_size
            total_pages
          }
        }
        attributeMetadata {
          sortable {
            label
            attribute
            numeric
          }
        }
      }
    `,
    
    productDetail: `
      query GET_PRODUCT_DATA($skus: [String]) {
        products(skus: $skus) {
          ...PRODUCT_FRAGMENT
        }
      }
      
      fragment PRODUCT_FRAGMENT on ProductView {
        __typename
        id
        sku
        name
        shortDescription
        metaDescription
        metaKeyword
        metaTitle
        description
        inStock
        addToCartAllowed
        url
        urlKey
        externalId
        images(roles: []) {
          url
          label
          roles
        }
        attributes(roles: []) {
          name
          label
          value
          roles
        }
        ... on SimpleProductView {
          price {
            roles
            regular {
              amount {
                value
                currency
              }
            }
            final {
              amount {
                value
                currency
              }
            }
          }
        }
        ... on ComplexProductView {
          options {
            ...PRODUCT_OPTION_FRAGMENT
          }
          ...PRICE_RANGE_FRAGMENT
        }
      }
      
      fragment PRODUCT_OPTION_FRAGMENT on ProductViewOption {
        id
        title
        required
        multi
        values {
          id
          title
          inStock
          __typename
          ... on ProductViewOptionValueProduct {
            title
            quantity
            isDefault
            __typename
            product {
              sku
              shortDescription
              metaDescription
              metaKeyword
              metaTitle
              name
              price {
                final {
                  amount {
                    value
                    currency
                  }
                }
                regular {
                  amount {
                    value
                    currency
                  }
                }
                roles
              }
            }
          }
          ... on ProductViewOptionValueSwatch {
            id
            title
            type
            value
            inStock
          }
        }
      }
      
      fragment PRICE_RANGE_FRAGMENT on ComplexProductView {
        priceRange {
          maximum {
            final {
              amount {
                value
                currency
              }
            }
            regular {
              amount {
                value
                currency
              }
            }
            roles
          }
          minimum {
            final {
              amount {
                value
                currency
              }
            }
            regular {
              amount {
                value
                currency
              }
            }
            roles
          }
        }
      }
    `
  }
};
