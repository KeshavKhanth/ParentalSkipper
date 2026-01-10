using System;
using System.Collections.Generic;
using Microsoft.Data.Sqlite;
using System.IO;

namespace ParentalSkipper.Data
{
    public class SkipperRepository : IDisposable
    {
        private readonly string _connectionString;

        public SkipperRepository(string dbPath)
        {
            _connectionString = $"Data Source={dbPath}";
            Initialize();
        }

        private void Initialize()
        {
            using (var connection = new SqliteConnection(_connectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                command.CommandText = @"
                    CREATE TABLE IF NOT EXISTS Segments (
                        Id INTEGER PRIMARY KEY AUTOINCREMENT,
                        ItemId TEXT NOT NULL,
                        Start REAL NOT NULL,
                        End REAL NOT NULL
                    );
                    CREATE INDEX IF NOT EXISTS idx_ItemId ON Segments(ItemId);
                ";
                command.ExecuteNonQuery();
            }
        }

        public void AddSegment(Guid itemId, double start, double end)
        {
            using (var connection = new SqliteConnection(_connectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                command.CommandText = "INSERT INTO Segments (ItemId, Start, End) VALUES ($itemId, $start, $end)";
                command.Parameters.AddWithValue("$itemId", itemId.ToString());
                command.Parameters.AddWithValue("$start", start);
                command.Parameters.AddWithValue("$end", end);
                command.ExecuteNonQuery();
            }
        }

        public List<Segment> GetSegments(Guid itemId)
        {
            var segments = new List<Segment>();
            using (var connection = new SqliteConnection(_connectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                command.CommandText = "SELECT Id, ItemId, Start, End FROM Segments WHERE ItemId = $itemId ORDER BY Start";
                command.Parameters.AddWithValue("$itemId", itemId.ToString());

                using (var reader = command.ExecuteReader())
                {
                    while (reader.Read())
                    {
                        segments.Add(new Segment
                        {
                            Id = reader.GetInt32(0),
                            ItemId = Guid.Parse(reader.GetString(1)),
                            Start = reader.GetDouble(2),
                            End = reader.GetDouble(3)
                        });
                    }
                }
            }
            return segments;
        }

        public void DeleteSegment(int id)
        {
            using (var connection = new SqliteConnection(_connectionString))
            {
                connection.Open();
                var command = connection.CreateCommand();
                command.CommandText = "DELETE FROM Segments WHERE Id = $id";
                command.Parameters.AddWithValue("$id", id);
                command.ExecuteNonQuery();
            }
        }

        public void Dispose()
        {
            // Nothing to dispose for SqliteConnection in this usage pattern
        }
    }
}
