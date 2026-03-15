using System;
using System.IO;
using System.Linq;
using System.Xml.Linq;
using System.Text.Json;
using System.Collections.Generic;
using System.Data;
using System.Data.Common;
using System.Text.RegularExpressions;


var input = "desc2026.xml";
var combinedOutput = "../../shared/src/static/combined-mesh-data.json";
var outputs = new Dictionary<char, string>()
{
    { 'C', "../../shared/src/static/common-disease-conditions.json" },
    { 'F', "../../shared/src/static/common-behavioral-conditions.json" },
    { 'M', "../../shared/src/static/common-named-groups.json" }
};

if (!File.Exists(input))
{
    Console.WriteLine($"{input} not found.");
    return;
}

var data = outputs.Keys.ToDictionary(k => k, v => new List<dynamic>());
var root = XElement.Load(input);

foreach (var record in root.Elements("DescriptorRecord"))
{
    var prefixes = record.Descendants("TreeNumber")
        .Select(tn => tn.Value[0])
        .Intersect(outputs.Keys)
        .Distinct()
        .ToList();

    if (prefixes.Count == 0)
        continue;

    var item = new
    {
        id = record.Element("DescriptorUI").Value,
        name = record.Element("DescriptorName").Element("String").Value,
        synonyms = record.Descendants("Term")
            .Select(t => t.Element("String").Value)
            .Distinct()
            .ToArray()
    };

    foreach (var prefix in prefixes)
    {
        data[prefix].Add(item);
    }
}

var minificationOptions = new JsonSerializerOptions
{
    WriteIndented = false,
    DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
};

foreach (var output in outputs)
{
    var outputItems = data[output.Key];
    var json = JsonSerializer.Serialize(outputItems, minificationOptions);
    File.WriteAllText(output.Value, json);
    Console.WriteLine($"Wrote {outputItems.Count} items to {output.Value}");
}

var items = data.Values
    .SelectMany(list => list)
    .GroupBy(item => item.id)
    .Select(group => group.First())
    .ToList();

string combinedJson = JsonSerializer.Serialize(items, minificationOptions);
File.WriteAllText(combinedOutput, combinedJson);

Console.WriteLine("Success");