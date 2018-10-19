const _ = require(`lodash`)
const Promise = require(`bluebird`)
const path = require(`path`)
const parseFilepath = require(`parse-filepath`)
const fs = require(`fs-extra`)
const slash = require(`slash`)
const slugify = require(`slugify`)
const url = require(`url`)
const getpkgjson = require(`get-package-json-from-github`)
const parseGHUrl = require(`parse-github-url`)
const { GraphQLClient } = require(`graphql-request`)

require(`dotenv`).config({
  path: `.env.${process.env.NODE_ENV}`,
})

if (
  process.env.gatsby_executing_command === `build` &&
  !process.env.GITHUB_API_TOKEN
) {
  throw new Error(
    `A GitHub token is required to build the site. Check the README.`
  )
}

// used to gather repo data on starters
const githubApiClient = process.env.GITHUB_API_TOKEN
  ? new GraphQLClient(`https://api.github.com/graphql`, {
      headers: {
        authorization: `Bearer ${process.env.GITHUB_API_TOKEN}`,
      },
    })
  : null

const localPackages = `../packages`
const localPackagesArr = []
fs.readdirSync(localPackages).forEach(file => {
  localPackagesArr.push(file)
})
// convert a string like `/some/long/path/name-of-docs/` to `name-of-docs`
const slugToAnchor = slug =>
  slug
    .split(`/`) // split on dir separators
    .filter(item => item !== ``) // remove empty values
    .pop() // take last item

exports.createPages = ({ graphql, actions }) => {
  const { createPage, createRedirect } = actions

  // Random redirects
  createRedirect({
    fromPath: `/blog/2018-02-26-documentation-project/`, // Tweeted this link out then switched it
    toPath: `/blog/2018-02-28-documentation-project/`,
    isPermanent: true,
  })

  createRedirect({
    fromPath: `/community/`, // Moved "Community" page from /community to /docs/community
    toPath: `/docs/community/`,
    isPermanent: true,
  })

  createRedirect({
    fromPath: `/packages/`, // Moved "Plugins" page from /packages to /plugins
    toPath: `/plugins/`,
    isPermanent: true,
  })

  createRedirect({
    fromPath: `/docs/netlify-cms/`,
    toPath: `/docs/sourcing-from-netlify-cms/`,
    isPermanent: true,
  })

  createRedirect({
    fromPath: `/starter-showcase/`, // Moved "Starter Showcase" index page from /starter-showcase to /starters
    toPath: `/starters/`,
    isPermanent: true,
  })

  createRedirect({
    fromPath: `/docs/gatsby-starters/`, // Main Gatsby starters page is the starter library
    toPath: `/starters/`,
    isPermanent: true,
  })

  createRedirect({
    fromPath: `/docs/adding-third-party-services/`,
    toPath: `/docs/adding-website-functionality/`,
    isPermanent: true,
  })

  createRedirect({
    fromPath: `/docs/bound-action-creators/`,
    toPath: `/docs/actions/`,
    isPermanent: true,
  })

  createRedirect({
    fromPath: `/docs/bound-action-creators`,
    toPath: `/docs/actions`,
    isPermanent: true,
  })

  createRedirect({
    fromPath: `/blog/2019-10-03-gatsby-perf`,
    toPath: `/blog/2018-10-03-gatsby-perf`,
    isPermanent: true,
  })

  return new Promise((resolve, reject) => {
    const docsTemplate = path.resolve(`src/templates/template-docs-markdown.js`)
    const blogPostTemplate = path.resolve(`src/templates/template-blog-post.js`)
    const blogListTemplate = path.resolve(`src/templates/template-blog-list.js`)
    const tagTemplate = path.resolve(`src/templates/tags.js`)
    const contributorPageTemplate = path.resolve(
      `src/templates/template-contributor-page.js`
    )
    const localPackageTemplate = path.resolve(
      `src/templates/template-docs-local-packages.js`
    )
    const remotePackageTemplate = path.resolve(
      `src/templates/template-docs-remote-packages.js`
    )
    const showcaseTemplate = path.resolve(
      `src/templates/template-showcase-details.js`
    )
    const creatorPageTemplate = path.resolve(
      `src/templates/template-creator-details.js`
    )

    // Query for markdown nodes to use in creating pages.
    graphql(
      `
        query {
          allMarkdownRemark(
            sort: { order: DESC, fields: [frontmatter___date] }
            limit: 10000
            filter: { fileAbsolutePath: { ne: null } }
          ) {
            edges {
              node {
                fields {
                  slug
                  package
                }
                frontmatter {
                  title
                  draft
                  canonicalLink
                  publishedAt
                  tags
                }
              }
            }
          }
          allAuthorYaml {
            edges {
              node {
                fields {
                  slug
                }
              }
            }
          }
          allCreatorsYaml {
            edges {
              node {
                fields {
                  slug
                }
              }
            }
          }
          allSitesYaml(filter: { main_url: { ne: null } }) {
            edges {
              node {
                fields {
                  slug
                }
              }
            }
          }
          allStartersYaml {
            edges {
              node {
                id
                fields {
                  starterShowcase {
                    slug
                    stub
                  }
                }
                url
                repo
              }
            }
          }
          allNpmPackage {
            edges {
              node {
                id
                title
                slug
                readme {
                  id
                  childMarkdownRemark {
                    id
                    html
                  }
                }
              }
            }
          }
        }
      `
    ).then(result => {
      if (result.errors) {
        return reject(result.errors)
      }

      const blogPosts = _.filter(result.data.allMarkdownRemark.edges, edge => {
        const slug = _.get(edge, `node.fields.slug`)
        const draft = _.get(edge, `node.frontmatter.draft`)
        if (!slug) return undefined

        if (_.includes(slug, `/blog/`) && !draft) {
          return edge
        }

        return undefined
      })

      // Create blog-list pages.
      const postsPerPage = 8
      const numPages = Math.ceil(blogPosts.length / postsPerPage)

      Array.from({ length: numPages }).forEach((_, i) => {
        createPage({
          path: i === 0 ? `/blog` : `/blog/page/${i + 1}`,
          component: slash(blogListTemplate),
          context: {
            limit: postsPerPage,
            skip: i * postsPerPage,
            numPages,
            currentPage: i + 1,
          },
        })
      })

      // Create blog-post pages.
      blogPosts.forEach((edge, index) => {
        const next = index === 0 ? null : blogPosts[index - 1].node
        const prev =
          index === blogPosts.length - 1 ? null : blogPosts[index + 1].node

        createPage({
          path: `${edge.node.fields.slug}`, // required
          component: slash(blogPostTemplate),
          context: {
            slug: edge.node.fields.slug,
            prev,
            next,
          },
        })
      })

      const tagLists = blogPosts
        .filter(post => _.get(post, `node.frontmatter.tags`))
        .map(post => _.get(post, `node.frontmatter.tags`))

      _.uniq(_.flatten(tagLists)).forEach(tag => {
        createPage({
          path: `/blog/tags/${_.kebabCase(tag.toLowerCase())}/`,
          component: tagTemplate,
          context: {
            tag,
          },
        })
      })

      // Create starter pages.
      const starters = _.filter(result.data.allStartersYaml.edges, edge => {
        const slug = _.get(edge, `node.fields.starterShowcase.slug`)
        if (!slug) {
          return null
        } else {
          return edge
        }
      })

      const starterTemplate = path.resolve(
        `src/templates/template-starter-page.js`
      )

      starters.forEach((edge, index) => {
        createPage({
          path: `/starters${edge.node.fields.starterShowcase.slug}`,
          component: slash(starterTemplate),
          context: {
            slug: edge.node.fields.starterShowcase.slug,
            stub: edge.node.fields.starterShowcase.stub,
          },
        })
      })

      // Create contributor pages.
      result.data.allAuthorYaml.edges.forEach(edge => {
        createPage({
          path: `${edge.node.fields.slug}`,
          component: slash(contributorPageTemplate),
          context: {
            slug: edge.node.fields.slug,
          },
        })
      })

      result.data.allCreatorsYaml.edges.forEach(edge => {
        if (!edge.node.fields) return
        if (!edge.node.fields.slug) return
        createPage({
          path: `${edge.node.fields.slug}`,
          component: slash(creatorPageTemplate),
          context: {
            slug: edge.node.fields.slug,
          },
        })
      })

      result.data.allSitesYaml.edges.forEach(edge => {
        if (!edge.node.fields) return
        if (!edge.node.fields.slug) return
        createPage({
          path: `${edge.node.fields.slug}`,
          component: slash(showcaseTemplate),
          context: {
            slug: edge.node.fields.slug,
          },
        })
      })

      // Create docs pages.
      result.data.allMarkdownRemark.edges.forEach(edge => {
        const slug = _.get(edge, `node.fields.slug`)
        if (!slug) return

        if (!_.includes(slug, `/blog/`)) {
          createPage({
            path: `${edge.node.fields.slug}`, // required
            component: slash(
              edge.node.fields.package ? localPackageTemplate : docsTemplate
            ),
            context: {
              slug: edge.node.fields.slug,
            },
          })
        }
      })

      const allPackages = result.data.allNpmPackage.edges
      // Create package readme
      allPackages.forEach(edge => {
        if (_.includes(localPackagesArr, edge.node.title)) {
          createPage({
            path: edge.node.slug,
            component: slash(localPackageTemplate),
            context: {
              slug: edge.node.slug,
              id: edge.node.id,
            },
          })
        } else {
          createPage({
            path: edge.node.slug,
            component: slash(remotePackageTemplate),
            context: {
              slug: edge.node.slug,
              id: edge.node.id,
            },
          })
        }
      })

      return resolve()
    })
  })
}

// Create slugs for files.
exports.onCreateNode = ({ node, actions, getNode, reporter }) => {
  const { createNodeField } = actions
  let slug
  if (node.internal.type === `File`) {
    const parsedFilePath = parseFilepath(node.relativePath)
    if (node.sourceInstanceName === `docs`) {
      if (parsedFilePath.name !== `index` && parsedFilePath.dir !== ``) {
        slug = `/${parsedFilePath.dir}/${parsedFilePath.name}/`
      } else if (parsedFilePath.dir === ``) {
        slug = `/${parsedFilePath.name}/`
      } else {
        slug = `/${parsedFilePath.dir}/`
      }
    }
    if (slug) {
      createNodeField({ node, name: `slug`, value: slug })
    }
  } else if (
    node.internal.type === `MarkdownRemark` &&
    getNode(node.parent).internal.type === `File`
  ) {
    const fileNode = getNode(node.parent)
    const parsedFilePath = parseFilepath(fileNode.relativePath)
    // Add slugs for docs pages
    if (fileNode.sourceInstanceName === `docs`) {
      if (parsedFilePath.name !== `index` && parsedFilePath.dir !== ``) {
        slug = `/${parsedFilePath.dir}/${parsedFilePath.name}/`
      } else if (parsedFilePath.dir === ``) {
        slug = `/${parsedFilePath.name}/`
      } else {
        slug = `/${parsedFilePath.dir}/`
      }
    }
    // Add slugs for package READMEs.
    if (
      fileNode.sourceInstanceName === `packages` &&
      parsedFilePath.name === `README`
    ) {
      slug = `/packages/${parsedFilePath.dir}/`
      createNodeField({
        node,
        name: `title`,
        value: parsedFilePath.dir,
      })
      createNodeField({ node, name: `package`, value: true })
    }
    if (slug) {
      createNodeField({ node, name: `anchor`, value: slugToAnchor(slug) })
      createNodeField({ node, name: `slug`, value: slug })
    }
  } else if (node.internal.type === `AuthorYaml`) {
    slug = `/contributors/${slugify(node.id, {
      lower: true,
    })}/`
    createNodeField({ node, name: `slug`, value: slug })
  } else if (node.internal.type === `SitesYaml` && node.main_url) {
    const parsed = url.parse(node.main_url)
    const cleaned = parsed.hostname + parsed.pathname
    slug = `/showcase/${slugify(cleaned)}`
    createNodeField({ node, name: `slug`, value: slug })
  } else if (node.internal.type === `StartersYaml` && node.repo) {
    // To develop on the starter showcase, you'll need a GitHub
    // personal access token. Check the `www` README for details.
    // Default fields are to avoid graphql errors.
    const { owner, name: repoStub } = parseGHUrl(node.repo)
    const defaultFields = {
      slug: `/${repoStub}/`,
      stub: repoStub,
      name: ``,
      description: ``,
      stars: 0,
      lastUpdated: ``,
      owner: ``,
      githubFullName: ``,
      gatsbyMajorVersion: [[`no data`, `0`]],
      allDependencies: [[`no data`, `0`]],
      gatsbyDependencies: [[`no data`, `0`]],
      miscDependencies: [[`no data`, `0`]],
    }

    if (!process.env.GITHUB_API_TOKEN) {
      return createNodeField({
        node,
        name: `starterShowcase`,
        value: {
          ...defaultFields,
        },
      })
    } else {
      return Promise.all([
        getpkgjson(node.repo),
        githubApiClient.request(`
            query {
              repository(owner:"${owner}", name:"${repoStub}") {
                name
                stargazers {
                  totalCount
                }
                createdAt
                updatedAt
                owner {
                  login
                }
                nameWithOwner
              }
            }
          `),
      ])
        .then(results => {
          const [pkgjson, githubData] = results
          const {
            stargazers: { totalCount: stars },
            updatedAt: lastUpdated,
            owner: { login: owner },
            name,
            nameWithOwner: githubFullName,
          } = githubData.repository

          const { dependencies = [], devDependencies = [] } = pkgjson
          const allDependencies = Object.entries(dependencies).concat(
            Object.entries(devDependencies)
          )

          const gatsbyMajorVersion = allDependencies
            .filter(([key, _]) => key === `gatsby`)
            .map(version => {
              let [gatsby, versionNum] = version
              if (versionNum === `latest` || versionNum === `next`) {
                return [gatsby, `2`]
              }
              return [gatsby, versionNum.replace(/\D/g, ``).charAt(0)]
            })

          // If a new field is added here, make sure a corresponding
          // change is made to "defaultFields" to not break DX
          const starterShowcaseFields = {
            slug: `/${repoStub}/`,
            stub: repoStub,
            name,
            description: pkgjson.description,
            stars,
            lastUpdated,
            owner,
            githubFullName,
            gatsbyMajorVersion,
            allDependencies,
            gatsbyDependencies: allDependencies
              .filter(
                ([key, _]) => ![`gatsby-cli`, `gatsby-link`].includes(key) // remove stuff everyone has
              )
              .filter(([key, _]) => key.includes(`gatsby`)),
            miscDependencies: allDependencies.filter(
              ([key, _]) => !key.includes(`gatsby`)
            ),
          }
          createNodeField({
            node,
            name: `starterShowcase`,
            value: starterShowcaseFields,
          })
        })
        .catch(err => {
          reporter.panicOnBuild(
            `Error getting repo data for starter "${repoStub}":\n
            ${err.message}`
          )
        })
    }
  }

  // Community/Creators Pages
  else if (node.internal.type === `CreatorsYaml`) {
    const validTypes = {
      individual: `people`,
      agency: `agencies`,
      company: `companies`,
    }

    if (!validTypes[node.type]) {
      throw new Error(
        `Creators must have a type of “individual”, “agency”, or “company”, but invalid type “${
          node.type
        }” was provided for ${node.name}.`
      )
    }
    slug = `/community/${validTypes[node.type]}/${slugify(node.name, {
      lower: true,
    })}`
    createNodeField({ node, name: `slug`, value: slug })
  }
  // end Community/Creators Pages
}

exports.onPostBuild = () => {
  fs.copySync(
    `../docs/blog/2017-02-21-1-0-progress-update-where-came-from-where-going/gatsbygram.mp4`,
    `./public/gatsbygram.mp4`
  )
}

// limited logging for debug purposes
let limitlogcount = 0
function log(max) {
  return function(...args) {
    if (limitlogcount++ < max) console.log(...args)
  }
}
