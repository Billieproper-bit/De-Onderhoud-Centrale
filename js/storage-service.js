import { supabase } from './supabase-config.js';

export async function uploadImages(folderName, files) {
    const urls = [];
    for (const file of files) {
        if (!(file instanceof File)) {
            if (typeof file === 'string') urls.push(file);
            continue;
        }

        const fileName = `${folderName}/${Date.now()}-${file.name}`;
        
        // Timeout van 8 seconden om 'hangen' te voorkomen
        const timeout = new Promise((_, reject) => 
            setTimeout(() => reject(new Error("Supabase reageert te traag")), 8000)
        );

        try {
            console.log("Upload start:", fileName);
            const uploadTask = supabase.storage.from('system-images').upload(fileName, file);
            
            const { data, error } = await Promise.race([uploadTask, timeout]);
            if (error) throw error;

            const { data: urlData } = supabase.storage.from('system-images').getPublicUrl(fileName);
            urls.push(urlData.publicUrl);
        } catch (err) {
            console.error("Upload mislukt voor:", file.name, err);
            // We gooien de error niet door, zodat de rest van het formulier wel kan opslaan
            alert(`Foto ${file.name} kon niet worden geüpload, maar we gaan door met de rest.`);
        }
    }
    return urls;
}
