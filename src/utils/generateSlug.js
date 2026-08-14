const generateSlug = (title) => {
    return title.toLowerCase().trim()
        .replace(/[^\w\s-]/g, '') 
        .replace(/[\s_-]+/g, '-') 
        .replace(/^-+|-+$/g, ''); 
};
module.exports = generateSlug;